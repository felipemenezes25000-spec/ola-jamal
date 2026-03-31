using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Authorization;

/// <summary>
/// Para usuários com role Doctor, exige approval_status = approved em doctor_profiles.
/// Retorna 403 se o médico estiver pendente ou reprovado.
/// </summary>
public class DoctorApprovalFilter : IAsyncActionFilter
{
    /// <summary>Endpoints que médicos pendentes podem acessar (perfil, avatar, senha). Permite completar cadastro para aprovação.</summary>
    private static readonly string[] AllowedPathsForPendingDoctor = ["/api/auth/avatar", "/api/auth/change-password", "/api/auth/me", "/api/doctors/me"];

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var path = context.HttpContext.Request.Path.Value ?? "";
        if (AllowedPathsForPendingDoctor.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await next();
            return;
        }

        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated == true && user.IsInRole("doctor"))
        {
            var repo = context.HttpContext.RequestServices.GetRequiredService<IDoctorRepository>();
            var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdClaim, out var userId))
            {
                var profile = await repo.GetByUserIdAsync(userId, context.HttpContext.RequestAborted);
                if (profile == null || profile.ApprovalStatus != DoctorApprovalStatus.Approved)
                {
                    var message = profile?.ApprovalStatus == DoctorApprovalStatus.Rejected
                        ? "Seu cadastro de médico foi reprovado. Entre em contato com o suporte."
                        : "Seu cadastro está em análise. Aguarde a aprovação do administrador.";
                    context.Result = new ObjectResult(new { message }) { StatusCode = 403 };
                    return;
                }
            }
        }

        await next();
    }
}
