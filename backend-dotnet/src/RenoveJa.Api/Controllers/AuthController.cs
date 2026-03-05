using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por autenticação, registro e login de usuários e médicos.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthService authService,
    IValidator<RegisterRequestDto> registerValidator,
    IValidator<RegisterDoctorRequestDto> registerDoctorValidator,
    IValidator<CompleteProfileRequestDto> completeProfileValidator,
    ILogger<AuthController> logger) : ControllerBase
{
    /// <summary>
    /// Registra um novo paciente na plataforma.
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(
        [FromBody] RegisterRequestDto request,
        CancellationToken cancellationToken)
    {
        var validationResult = await registerValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        try
        {
            var response = await authService.RegisterAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Auth Register falhou");
            throw;
        }
    }

    /// <summary>
    /// Registra um novo médico na plataforma.
    /// </summary>
    [EnableRateLimiting("register")]
    [HttpPost("register-doctor")]
    public async Task<ActionResult<AuthResponseDto>> RegisterDoctor(
        [FromBody] RegisterDoctorRequestDto request,
        CancellationToken cancellationToken)
    {
        var validationResult = await registerDoctorValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        var response = await authService.RegisterDoctorAsync(request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Realiza login com e-mail e senha.
    /// </summary>
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(
        [FromBody] LoginRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            logger.LogInformation("[Auth] Login attempt");
            var response = await authService.LoginAsync(request!, cancellationToken);
            logger.LogInformation("[Auth] Login success: UserId={UserId}", response.User.Id);
            return Ok(response);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Auth] Login failed: Exception={Type}", ex.GetType().Name);
            throw;
        }
    }

    /// <summary>
    /// Retorna os dados do usuário autenticado.
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await authService.GetMeAsync(userId, cancellationToken);
        return Ok(user);
    }

    /// <summary>
    /// Encerra a sessão do usuário (invalida o token).
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        await authService.LogoutAsync(token, cancellationToken);
        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Autentica via Google OAuth.
    /// Se o usuário for novo, retorna profileComplete: false; o front deve exibir tela para concluir cadastro (phone, CPF, birth date).
    /// </summary>
    [EnableRateLimiting("auth")]
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponseDto>> GoogleAuth(
        [FromBody] GoogleAuthRequestDto request,
        CancellationToken cancellationToken)
    {
        var response = await authService.GoogleAuthAsync(request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Conclui o cadastro (phone, CPF, data de nascimento) para usuários criados via Google.
    /// Só pode ser chamado uma vez; após isso profileComplete fica true.
    /// </summary>
    [Authorize]
    [HttpPatch("complete-profile")]
    public async Task<ActionResult<UserDto>> CompleteProfile(
        [FromBody] CompleteProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        var validationResult = await completeProfileValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await authService.CompleteProfileAsync(userId, request, cancellationToken);
        return Ok(user);
    }

    /// <summary>
    /// Cancela o cadastro e remove o usuário (rollback). Apenas para quem ainda não concluiu o perfil (ex.: criado via Google).
    /// Após chamar, o token deixa de ser válido e o usuário é apagado.
    /// </summary>
    [Authorize]
    [HttpPost("cancel-registration")]
    public async Task<IActionResult> CancelRegistration(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        await authService.CancelRegistrationAsync(userId, cancellationToken);
        return Ok(new { message = "Registration cancelled. Account removed." });
    }

    /// <summary>
    /// Esqueci minha senha. Envia e-mail com link para redefinição (se o e-mail existir).
    /// Sempre retorna sucesso para não revelar se o e-mail está cadastrado.
    /// </summary>
    [HttpPost("forgot-password")]
    [EnableRateLimiting("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            await authService.ForgotPasswordAsync(request.Email ?? "", cancellationToken);
            return Ok(new
                { message = "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha." });
        }
        catch (Exception e)
        {
            logger.LogError(e, "Auth ForgotPassword falhou");
            throw;
        }
    }

    /// <summary>
    /// Atualiza o avatar do usuário (foto de perfil). Aceita multipart/form-data com campo "avatar".
    /// </summary>
    [Authorize]
    [HttpPatch("avatar")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<UserDto>> UpdateAvatar(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        if (!Request.HasFormContentType || Request.Form.Files.Count == 0)
            return BadRequest(new { error = "Envie uma imagem no campo 'avatar' (multipart/form-data)." });

        var file = Request.Form.Files.GetFile("avatar") ?? Request.Form.Files[0];
        if (file.Length == 0)
            return BadRequest(new { error = "O arquivo está vazio." });
        if (file.Length > 4 * 1024 * 1024)
            return BadRequest(new { error = "A imagem deve ter no máximo 4 MB." });

        var allowed = new[] { "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif" };
        var contentType = file.ContentType ?? "image/jpeg";
        if (!allowed.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { error = $"Tipo não permitido: {contentType}. Use: JPEG, PNG, WebP ou HEIC." });

        await using var stream = file.OpenReadStream();
        var user = await authService.UpdateAvatarAsync(userId, stream, contentType, file.FileName, cancellationToken);
        return Ok(user);
    }

    /// <summary>
    /// Altera a senha do usuário logado (requer senha atual).
    /// </summary>
    [Authorize]
    [HttpPatch("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        await authService.ChangePasswordAsync(
            userId,
            request.CurrentPassword ?? "",
            request.NewPassword ?? "",
            cancellationToken);
        return Ok(new { message = "Senha alterada com sucesso." });
    }

    /// <summary>
    /// Redefine a senha usando o token recebido por e-mail.
    /// </summary>
    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            await authService.ResetPasswordAsync(request.Token ?? "", request.NewPassword ?? "", cancellationToken);
            return Ok(new { message = "Senha alterada com sucesso. Faça login com a nova senha." });
        }
        catch (Exception e)
        {
            logger.LogError(e, "Auth ResetPassword falhou");
            throw;
        }
    }
}
