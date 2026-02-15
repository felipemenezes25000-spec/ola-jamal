using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RenoveJa.Api.Swagger;

/// <summary>
/// Adiciona no Swagger a opção multipart/form-data para POST /api/requests/prescription,
/// com campo de upload de imagens, prescriptionType e medications.
/// </summary>
public class PrescriptionUploadOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var path = context.ApiDescription.RelativePath?.TrimStart('/') ?? "";
        if (path != "api/requests/prescription" ||
            !string.Equals(context.ApiDescription.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
            return;

        var multipartSchema = new OpenApiSchema
        {
            Type = "object",
            Required = new HashSet<string> { "prescriptionType", "images" },
            Properties =
            {
                ["prescriptionType"] = new OpenApiSchema
                {
                    Type = "string",
                    Enum = new List<IOpenApiAny>
                    {
                        new OpenApiString("simples"),
                        new OpenApiString("controlado"),
                        new OpenApiString("azul")
                    },
                    Description = "Tipo da receita (simples R$ 50, controlado R$ 80, azul R$ 100)"
                },
                ["images"] = new OpenApiSchema
                {
                    Type = "array",
                    Description = "Uma ou mais fotos da receita (JPEG, PNG, WebP, HEIC; máx. 10 MB cada)",
                    Items = new OpenApiSchema { Type = "string", Format = "binary" }
                }
            }
        };

        operation.RequestBody ??= new OpenApiRequestBody
        {
            Description = "JSON: prescriptionType, opcional medications e prescriptionImages. Multipart: prescriptionType e images (fotos salvas no Supabase Storage)."
        };
        operation.RequestBody.Content["multipart/form-data"] = new OpenApiMediaType
        {
            Schema = multipartSchema
        };

        // Exemplo para application/json com tipo em português
        if (operation.RequestBody.Content.TryGetValue("application/json", out var jsonContent))
            jsonContent.Example = new OpenApiObject
            {
                ["prescriptionType"] = new OpenApiString("simples"),
                ["medications"] = new OpenApiArray(),
                ["prescriptionImages"] = new OpenApiArray()
            };
    }
}
