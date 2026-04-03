using System.Globalization;
using System.Text;
using RenoveJa.Application.DTOs.Assistant;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Application.Services.Assistant;

public class AssistantNavigatorService(IRequestService requestService) : IAssistantNavigatorService
{
    public async Task<AssistantNextActionResponseDto> GetNextActionAsync(
        AssistantNextActionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var (statusRaw, requestTypeRaw, hasSignedDocument) = await ResolveContextAsync(request, userId, cancellationToken);
        var status = NormalizeStatus(statusRaw);
        var requestType = (requestTypeRaw ?? string.Empty).Trim().ToLowerInvariant();

        return status switch
        {
            "submitted" => new AssistantNextActionResponseDto(
                "Pedido recebido",
                "Seu pedido entrou na fila de análise clínica.",
                "Aguarde. Se precisar, abra o detalhe para acompanhar em tempo real.",
                "Normalmente em 3 a 10 minutos.",
                null,
                "track"),

            "in_review" => new AssistantNextActionResponseDto(
                "Em análise médica",
                "Um profissional está revisando as informações enviadas.",
                "Mantenha notificações ativas. Se houver pendência, você será avisado.",
                "Geralmente conclui em ate 10 minutos.",
                null,
                "wait"),

            "approved_pending_payment" or "consultation_ready" or "paid" when requestType == "consultation" => new AssistantNextActionResponseDto(
                "Consulta aprovada",
                "Seu pedido foi aprovado. Agora falta o médico iniciar o atendimento.",
                "Fique no app. Você será levado automaticamente para a consulta quando iniciar.",
                "Normalmente em poucos minutos.",
                null,
                "wait"),

            "approved_pending_payment" or "paid" => new AssistantNextActionResponseDto(
                "Pedido aprovado",
                "Seu pedido foi aprovado pelo médico.",
                "Agora o médico prepara e assina seu documento.",
                "Tempo médio de assinatura: 3 a 10 minutos.",
                null,
                "wait"),

            "signed" or "delivered" => new AssistantNextActionResponseDto(
                "Documento pronto",
                "Seu documento já está disponível para uso.",
                "Baixe o PDF e apresente em farmácia/laboratório quando necessário.",
                "Disponivel agora.",
                hasSignedDocument ? "Baixar documento" : null,
                hasSignedDocument ? "download" : "none"),

            "consultation_finished" => new AssistantNextActionResponseDto(
                "Consulta finalizada",
                "Seu atendimento foi concluido com sucesso.",
                "Revise as orientações no detalhe e acesse o documento quando disponível.",
                "Disponivel agora.",
                null,
                "track"),

            "rejected" => new AssistantNextActionResponseDto(
                "Pedido não aprovado",
                "Seu pedido foi rejeitado nesta etapa.",
                "Revise o motivo no detalhe e reenvie com os ajustes.",
                "Reenvio imediato.",
                null,
                "support"),

            "cancelled" => new AssistantNextActionResponseDto(
                "Pedido cancelado",
                "Este pedido foi encerrado.",
                "Se ainda precisar, crie um novo pedido guiado pela Dra. RenoveJa.",
                "Você pode iniciar agora.",
                null,
                "none"),

            _ => new AssistantNextActionResponseDto(
                "Acompanhando seu pedido",
                "Estamos monitorando o fluxo.",
                "Abra o detalhe para ver a etapa atual.",
                "Atualização em tempo real.",
                null,
                "track")
        };
    }

    public AssistantCompleteResponseDto EvaluateCompleteness(AssistantCompleteRequestDto request)
    {
        var flow = NormalizeFlow(request.Flow);
        var checks = flow switch
        {
            "prescription" => BuildPrescriptionChecks(request),
            "exam" => BuildExamChecks(request),
            "consultation" => BuildConsultationChecks(request),
            _ => new List<AssistantCompletenessCheckDto>()
        };

        var totalWeight = checks.Sum(c => c.Required ? 2 : 1);
        var completedWeight = checks.Sum(c => c.Done ? (c.Required ? 2 : 1) : 0);
        var score = totalWeight == 0 ? 0 : (int)Math.Round((completedWeight * 100.0) / totalWeight);
        var missingFields = checks.Where(c => c.Required && !c.Done).Select(c => c.Id).ToList();
        var doneCount = checks.Count(c => c.Done);
        var totalCount = checks.Count;
        var redFlags = DetectRedFlags(request.Symptoms);

        string? urgencyMessage = null;
        if (redFlags.HasRisk)
        {
            urgencyMessage = redFlags.Category == "psychological"
                ? "Sinto muito que você esteja passando por isso. Você não precisa lidar com isso sozinho(a). Procure ajuda agora — ligue para o CVV (188) ou vá até um pronto-atendimento. Se puder, fale com alguém de confiança neste momento."
                : "Seus sintomas podem indicar uma emergência médica. Procure imediatamente um pronto-atendimento ou ligue para o SAMU (192).";
        }

        return new AssistantCompleteResponseDto(
            score,
            doneCount,
            totalCount,
            missingFields,
            checks,
            redFlags.HasRisk,
            redFlags.Signals,
            urgencyMessage
        );
    }

    private async Task<(string Status, string RequestType, bool HasSignedDocument)> ResolveContextAsync(
        AssistantNextActionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (request.RequestId.HasValue)
        {
            var dto = await requestService.GetRequestByIdAsync(request.RequestId.Value, userId, cancellationToken);
            return (
                dto.Status ?? string.Empty,
                dto.RequestType ?? string.Empty,
                !string.IsNullOrWhiteSpace(dto.SignedDocumentUrl)
            );
        }

        return (
            request.Status ?? string.Empty,
            request.RequestType ?? string.Empty,
            request.HasSignedDocument ?? false
        );
    }

    private static List<AssistantCompletenessCheckDto> BuildPrescriptionChecks(AssistantCompleteRequestDto request)
    {
        var imagesCount = Math.Max(0, request.ImagesCount ?? 0);
        return new List<AssistantCompletenessCheckDto>
        {
            new AssistantCompletenessCheckDto(
                "prescription_type",
                "Selecionar o tipo de receita",
                true,
                !string.IsNullOrWhiteSpace(request.PrescriptionType)),
            new AssistantCompletenessCheckDto(
                "main_photo",
                "Anexar ao menos 1 foto legivel",
                true,
                imagesCount > 0),
            new AssistantCompletenessCheckDto(
                "extra_photo",
                "Adicionar 2a foto para aumentar legibilidade",
                false,
                imagesCount > 1),
        };
    }

    private static List<AssistantCompletenessCheckDto> BuildExamChecks(AssistantCompleteRequestDto request)
    {
        var imagesCount = Math.Max(0, request.ImagesCount ?? 0);
        var examsCount = Math.Max(0, request.ExamsCount ?? 0);
        var symptoms = request.Symptoms?.Trim() ?? string.Empty;
        var hasClinicalContext = symptoms.Length >= 10;
        var hasExamDescription = examsCount > 0 || imagesCount > 0;

        return new List<AssistantCompletenessCheckDto>
        {
            new AssistantCompletenessCheckDto(
                "exam_type",
                "Selecionar o tipo de exame",
                true,
                !string.IsNullOrWhiteSpace(request.ExamType)),
            new AssistantCompletenessCheckDto(
                "exam_or_image",
                "Informar exame desejado ou anexar pedido",
                true,
                hasExamDescription),
            new AssistantCompletenessCheckDto(
                "symptoms",
                "Descrever sintomas/indicação clínica",
                true,
                hasClinicalContext),
            new AssistantCompletenessCheckDto(
                "detailed_symptoms",
                "Adicionar contexto detalhado (40+ caracteres)",
                false,
                symptoms.Length >= 40),
        };
    }

    private static List<AssistantCompletenessCheckDto> BuildConsultationChecks(AssistantCompleteRequestDto request)
    {
        var durationMinutes = Math.Max(0, request.DurationMinutes ?? 0);
        var symptoms = request.Symptoms?.Trim() ?? string.Empty;
        return new List<AssistantCompletenessCheckDto>
        {
            new AssistantCompletenessCheckDto(
                "professional_type",
                "Escolher o profissional",
                true,
                !string.IsNullOrWhiteSpace(request.ConsultationType)),
            new AssistantCompletenessCheckDto(
                "duration",
                "Definir duração da consulta",
                true,
                durationMinutes >= 5),
            new AssistantCompletenessCheckDto(
                "main_reason",
                "Descrever sintomas ou dúvida principal",
                true,
                symptoms.Length >= 10),
            new AssistantCompletenessCheckDto(
                "details",
                "Adicionar detalhes (quando comecou, frequencia, intensidade)",
                false,
                symptoms.Length >= 40),
        };
    }

    private static string NormalizeStatus(string status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "pending" => "submitted",
            "analyzing" => "in_review",
            "pending_payment" => "approved_pending_payment",
            "payment_pending" => "approved_pending_payment",
            "approved" => "approved_pending_payment",
            "awaiting_signature" => "approved_pending_payment",
            "completed" => "delivered",
            _ => normalized,
        };
    }

    private static string NormalizeFlow(string? flow)
    {
        return (flow ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "prescription" => "prescription",
            "exam" => "exam",
            "consultation" => "consultation",
            _ => string.Empty
        };
    }

    private static (bool HasRisk, List<string> Signals, string? Category) DetectRedFlags(string? symptoms)
    {
        var normalizedText = NormalizeFreeText(symptoms);
        if (string.IsNullOrWhiteSpace(normalizedText))
            return (false, new List<string>(), null);

        // Physical emergency patterns
        var physicalRules = new Dictionary<string, string[]>
        {
            ["dor no peito"] = ["dor no peito", "pressao no peito", "dor no coracao"],
            ["taquicardia"] = ["taquicardia", "coracao acelerado", "coracao disparado"],
            ["falta de ar"] = ["falta de ar", "nao consigo respirar", "dificuldade para respirar", "falta de ar intensa"],
            ["desmaio"] = ["desmaio", "desmaiei", "vou desmaiar"],
            ["confusao mental"] = ["confusao mental", "estou confuso", "desorientacao"],
            ["sinais neurologicos"] = ["fraqueza de um lado", "rosto torto", "fala enrolada", "convulsao"],
            ["sangramento intenso"] = ["sangramento intenso", "sangue em grande quantidade"],
            ["sinais de AVC/derrame"] = ["avc", "derrame", "paralisia subit", "dor de cabeca subit", "perda de visao"],
        };

        // Psychological crisis / suicide risk patterns
        var psychologicalRules = new Dictionary<string, string[]>
        {
            ["risco de suicidio"] = [
                "quero me matar", "vou me matar", "pensar em me matar", "pensando em me matar",
                "nao aguento mais viver", "nao quero mais viver",
                "vou fazer algo contra mim", "vou acabar com tudo",
                "ideacao suicida", "suicid", "me machucar",
                "vou tirar minha vida", "tentei me matar"
            ],
            ["autolesao"] = [
                "estou me cortando", "me corto", "autolesao", "auto lesao",
                "me machuco de proposito", "me machucar de proposito"
            ],
        };

        var signals = new List<string>();
        string? category = null;

        foreach (var (signal, keywords) in physicalRules)
        {
            if (keywords.Any(normalizedText.Contains))
            {
                signals.Add(signal);
                category ??= "physical";
            }
        }

        foreach (var (signal, keywords) in psychologicalRules)
        {
            if (keywords.Any(normalizedText.Contains))
            {
                signals.Add(signal);
                category = "psychological"; // psychological takes priority for guidance tone
            }
        }

        return (signals.Count > 0, signals, category);
    }

    private static string NormalizeFreeText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var formD = text.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in formD)
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(c);
            if (uc != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
