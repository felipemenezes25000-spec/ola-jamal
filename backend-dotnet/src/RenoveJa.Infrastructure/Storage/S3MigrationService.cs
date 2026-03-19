using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using RenoveJa.Application.Helpers;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Storage;

/// <summary>
/// Migra objetos S3 de paths legados para o novo padrão baseado em paciente:
///   pacientes/{patientId}/{tipo}/{requestId}/...
/// Copia objetos (mantém originais como backup) e atualiza URLs no banco.
/// </summary>
public sealed class S3MigrationService(
    IAmazonS3 s3,
    IOptions<S3StorageConfig> s3Config,
    IOptions<DatabaseConfig> dbConfig,
    ILogger<S3MigrationService> logger)
{
    private readonly S3StorageConfig _cfg = s3Config.Value;

    public record MigrationResult(int Scanned, int Copied, int DbUpdated, int Errors, List<string> ErrorDetails);

    public async Task<MigrationResult> MigrateAsync(bool dryRun = true, CancellationToken ct = default)
    {
        var errors = new List<string>();
        var copied = 0;
        var dbUpdated = 0;
        var scanned = 0;

        // 1. Migrate signed prescriptions: signed/{requestId}.pdf → pacientes/{patientId}/pedidos/{requestId}/receita/assinado/receita-{requestId}.pdf
        var prescriptionMap = await LoadRequestPatientMapAsync(ct);
        var signedObjects = await ListObjectsAsync(_cfg.PrescriptionsBucket, "signed/", ct);
        foreach (var obj in signedObjects)
        {
            scanned++;
            var key = obj.Key;
            // signed/{requestId}.pdf or signed/{requestId}-exame.pdf
            var fileName = Path.GetFileNameWithoutExtension(key);
            var isExam = fileName.EndsWith("-exame", StringComparison.OrdinalIgnoreCase);
            var idStr = isExam ? fileName.Replace("-exame", "") : fileName;

            if (!Guid.TryParse(idStr, out var requestId) || !prescriptionMap.TryGetValue(requestId, out var patientId))
            {
                errors.Add($"Skip {key}: cannot resolve patientId");
                continue;
            }

            var newKey = isExam
                ? StoragePaths.ExameAssinado(patientId, requestId)
                : StoragePaths.ReceitaAssinada(patientId, requestId);

            if (await CopyIfNeededAsync(_cfg.PrescriptionsBucket, key, _cfg.PrescriptionsBucket, newKey, dryRun, ct))
                copied++;
        }

        // 2. Migrate transcriptions: consultas/{requestId}/transcricao/... → pacientes/{patientId}/consultas/{requestId}/transcricao/...
        var transcriptObjects = await ListObjectsAsync(_cfg.TranscriptsBucket, "consultas/", ct);
        foreach (var obj in transcriptObjects)
        {
            scanned++;
            var key = obj.Key;
            // Extract requestId from consultas/{requestId}/...
            var parts = key.Split('/');
            if (parts.Length < 3 || !Guid.TryParse(parts[1], out var reqId))
            {
                errors.Add($"Skip {key}: cannot parse requestId");
                continue;
            }

            if (!prescriptionMap.TryGetValue(reqId, out var patId))
            {
                errors.Add($"Skip {key}: requestId {reqId} not in map");
                continue;
            }

            var subPath = string.Join("/", parts.Skip(2));
            var newKey = $"pacientes/{patId:N}/consultas/{reqId:N}/{subPath}";

            var destBucket = key.Contains("/gravacao/") || key.Contains("/recordings/")
                ? _cfg.TranscriptsBucket
                : _cfg.TranscriptsBucket;

            if (await CopyIfNeededAsync(_cfg.TranscriptsBucket, key, destBucket, newKey, dryRun, ct))
                copied++;
        }

        // 3. Migrate recordings: recordings/consultas/{requestId}/... → pacientes/{patientId}/consultas/{requestId}/gravacao/...
        var recordingObjects = await ListObjectsAsync(_cfg.TranscriptsBucket, "recordings/", ct);
        foreach (var obj in recordingObjects)
        {
            scanned++;
            var key = obj.Key;
            var parts = key.Split('/');
            // recordings/consultas/{requestId}/filename
            if (parts.Length < 4 || !Guid.TryParse(parts[2], out var reqId2))
            {
                errors.Add($"Skip {key}: cannot parse requestId from recording path");
                continue;
            }

            if (!prescriptionMap.TryGetValue(reqId2, out var patId2))
            {
                errors.Add($"Skip {key}: requestId {reqId2} not in map");
                continue;
            }

            var fileName2 = parts.Last();
            var recordingId = Path.GetFileNameWithoutExtension(fileName2);
            var newKey = StoragePaths.Gravacao(patId2, reqId2, recordingId);

            if (await CopyIfNeededAsync(_cfg.TranscriptsBucket, key, _cfg.TranscriptsBucket, newKey, dryRun, ct))
                copied++;
        }

        // 4. Migrate avatars: avatars/{userId}/... → pacientes/{userId}/avatar/...
        var avatarObjects = await ListObjectsAsync(_cfg.AvatarsBucket, "avatars/", ct);
        foreach (var obj in avatarObjects)
        {
            scanned++;
            var key = obj.Key;
            var parts = key.Split('/');
            if (parts.Length < 3 || !Guid.TryParse(parts[1], out var userId))
            {
                errors.Add($"Skip {key}: cannot parse userId from avatar path");
                continue;
            }

            var fileName3 = parts.Last();
            var newKey = StoragePaths.Avatar(userId, fileName3);

            if (await CopyIfNeededAsync(_cfg.AvatarsBucket, key, _cfg.AvatarsBucket, newKey, dryRun, ct))
                copied++;
        }

        // 5. Migrate certificates: certificates/{id}.pfx.enc → pacientes/{doctorProfileId}/certificados/{id}.pfx.enc
        var certObjects = await ListObjectsAsync(_cfg.CertificatesBucket, "certificates/", ct);
        foreach (var obj in certObjects)
        {
            scanned++;
            var key = obj.Key;
            var fileName4 = Path.GetFileName(key);
            var idStr2 = fileName4.Replace(".pfx.enc", "");
            if (!Guid.TryParse(idStr2, out var certId))
            {
                errors.Add($"Skip {key}: cannot parse certificate id");
                continue;
            }

            // certificates use the doctorProfileId as the file id
            var newKey = $"pacientes/{certId:N}/certificados/{certId:N}.pfx.enc";

            if (await CopyIfNeededAsync(_cfg.CertificatesBucket, key, _cfg.CertificatesBucket, newKey, dryRun, ct))
                copied++;
        }

        // 6. Update DB URLs (only if not dry run)
        if (!dryRun)
        {
            dbUpdated = await UpdateDatabaseUrlsAsync(prescriptionMap, ct, errors);
        }

        var result = new MigrationResult(scanned, copied, dbUpdated, errors.Count, errors);
        logger.LogInformation(
            "[S3Migration] {Mode}: Scanned={Scanned} Copied={Copied} DbUpdated={DbUpdated} Errors={Errors}",
            dryRun ? "DRY-RUN" : "LIVE", result.Scanned, result.Copied, result.DbUpdated, result.Errors);

        return result;
    }

    private async Task<Dictionary<Guid, Guid>> LoadRequestPatientMapAsync(CancellationToken ct)
    {
        var map = new Dictionary<Guid, Guid>();
        var connStr = dbConfig.Value.DatabaseUrl;
        if (string.IsNullOrEmpty(connStr)) return map;

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT id, patient_id FROM requests WHERE patient_id IS NOT NULL", conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[reader.GetGuid(0)] = reader.GetGuid(1);
        }

        logger.LogInformation("[S3Migration] Loaded {Count} request→patient mappings", map.Count);
        return map;
    }

    private async Task<List<S3Object>> ListObjectsAsync(string bucket, string prefix, CancellationToken ct)
    {
        var objects = new List<S3Object>();
        string? continuationToken = null;

        do
        {
            var response = await s3.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = bucket,
                Prefix = prefix,
                ContinuationToken = continuationToken
            }, ct);

            objects.AddRange(response.S3Objects);
            continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
        } while (continuationToken != null);

        return objects;
    }

    private async Task<bool> CopyIfNeededAsync(
        string srcBucket, string srcKey,
        string dstBucket, string dstKey,
        bool dryRun, CancellationToken ct)
    {
        if (srcKey == dstKey && srcBucket == dstBucket)
            return false;

        // Check if destination already exists
        try
        {
            await s3.GetObjectMetadataAsync(dstBucket, dstKey, ct);
            logger.LogDebug("[S3Migration] Already exists: {Bucket}/{Key}", dstBucket, dstKey);
            return false;
        }
        catch (Amazon.S3.AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Expected — destination doesn't exist yet
        }

        if (dryRun)
        {
            logger.LogInformation("[S3Migration] DRY-RUN would copy: {SrcBucket}/{SrcKey} → {DstBucket}/{DstKey}",
                srcBucket, srcKey, dstBucket, dstKey);
            return true;
        }

        await s3.CopyObjectAsync(new CopyObjectRequest
        {
            SourceBucket = srcBucket,
            SourceKey = srcKey,
            DestinationBucket = dstBucket,
            DestinationKey = dstKey
        }, ct);

        logger.LogInformation("[S3Migration] Copied: {SrcBucket}/{SrcKey} → {DstBucket}/{DstKey}",
            srcBucket, srcKey, dstBucket, dstKey);
        return true;
    }

    private async Task<int> UpdateDatabaseUrlsAsync(
        Dictionary<Guid, Guid> requestPatientMap,
        CancellationToken ct,
        List<string> errors)
    {
        var updated = 0;
        var connStr = dbConfig.Value.DatabaseUrl;
        if (string.IsNullOrEmpty(connStr)) return 0;

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync(ct);

        // Update signed_document_url in requests table (prescriptions)
        await using (var cmd = new NpgsqlCommand("""
            UPDATE requests SET signed_document_url =
                REPLACE(signed_document_url, 'signed/',
                    CONCAT('pacientes/', REPLACE(patient_id::text, '-', ''), '/pedidos/', REPLACE(id::text, '-', ''), '/receita/assinado/'))
            WHERE signed_document_url IS NOT NULL
              AND signed_document_url LIKE '%signed/%'
              AND signed_document_url NOT LIKE '%pacientes/%'
            """, conn))
        {
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            updated += rows;
            logger.LogInformation("[S3Migration] Updated {Rows} signed_document_url rows", rows);
        }

        // Update recording_file_url in consultation_anamnesis table
        await using (var cmd = new NpgsqlCommand("""
            UPDATE consultation_anamnesis ca SET recording_file_url =
                REPLACE(recording_file_url, 'recordings/consultas/',
                    CONCAT('pacientes/', REPLACE(
                        (SELECT REPLACE(r.patient_id::text, '-', '') FROM requests r WHERE r.id = ca.request_id),
                        '-', ''), '/consultas/'))
            WHERE recording_file_url IS NOT NULL
              AND recording_file_url LIKE '%recordings/consultas/%'
              AND recording_file_url NOT LIKE '%pacientes/%'
            """, conn))
        {
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            updated += rows;
            logger.LogInformation("[S3Migration] Updated {Rows} recording_file_url rows", rows);
        }

        // Update transcript_file_url in consultation_anamnesis table
        await using (var cmd = new NpgsqlCommand("""
            UPDATE consultation_anamnesis ca SET transcript_file_url =
                REPLACE(transcript_file_url, 'consultas/',
                    CONCAT('pacientes/', REPLACE(
                        (SELECT REPLACE(r.patient_id::text, '-', '') FROM requests r WHERE r.id = ca.request_id),
                        '-', ''), '/consultas/'))
            WHERE transcript_file_url IS NOT NULL
              AND transcript_file_url LIKE 'consultas/%'
              AND transcript_file_url NOT LIKE '%pacientes/%'
            """, conn))
        {
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            updated += rows;
            logger.LogInformation("[S3Migration] Updated {Rows} transcript_file_url rows", rows);
        }

        return updated;
    }
}
