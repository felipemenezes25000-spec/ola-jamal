using Xunit;
using Moq;
using FluentAssertions;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Exceptions;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.Entities;

namespace RenoveJa.UnitTests.Application;

public class AuthServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IDoctorRepository> _doctorRepositoryMock;
    private readonly Mock<IAuthTokenRepository> _tokenRepositoryMock;
    private readonly Mock<IPasswordResetTokenRepository> _passwordResetTokenRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _doctorRepositoryMock = new Mock<IDoctorRepository>();
        _tokenRepositoryMock = new Mock<IAuthTokenRepository>();
        _passwordResetTokenRepositoryMock = new Mock<IPasswordResetTokenRepository>();
        _emailServiceMock = new Mock<IEmailService>();

        var smtpConfig = Options.Create(new SmtpConfig());
        var googleAuthConfig = Options.Create(new GoogleAuthConfig());

        _authService = new AuthService(
            _userRepositoryMock.Object,
            _doctorRepositoryMock.Object,
            _tokenRepositoryMock.Object,
            _passwordResetTokenRepositoryMock.Object,
            _emailServiceMock.Object,
            smtpConfig,
            googleAuthConfig);
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateUserAndToken_WhenValidRequest()
    {
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123",
            "password123",
            "11987654321",
            "12345678901");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(false);

        _userRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<User>(), default))
            .ReturnsAsync((User user, CancellationToken _) => user);

        _tokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<AuthToken>(), default))
            .ReturnsAsync((AuthToken token, CancellationToken _) => token);

        var response = await _authService.RegisterAsync(request);

        response.Should().NotBeNull();
        response.User.Should().NotBeNull();
        response.User.Email.Should().Be("john@example.com");
        response.Token.Should().NotBeNullOrEmpty();

        _userRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<User>(), default), Times.Once);
        _tokenRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<AuthToken>(), default), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ShouldThrow_WhenEmailAlreadyExists()
    {
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123",
            "password123",
            "11987654321",
            "12345678901");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(true);

        Func<Task> act = async () => await _authService.RegisterAsync(request);

        await act.Should().ThrowAsync<AuthConflictException>()
            .WithMessage("*Este e-mail já está cadastrado*");
    }

    [Fact]
    public async Task LoginAsync_ShouldReturnToken_WhenCredentialsValid()
    {
        var request = new LoginRequestDto("john@example.com", "password123");

        var passwordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        var user = User.Reconstitute(
            Guid.NewGuid(),
            "John Doe",
            "john@example.com",
            passwordHash,
            "patient",
            null,
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(user);

        _tokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<AuthToken>(), default))
            .ReturnsAsync((AuthToken token, CancellationToken _) => token);

        var response = await _authService.LoginAsync(request);

        response.Should().NotBeNull();
        response.User.Email.Should().Be("john@example.com");
        response.Token.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task LoginAsync_ShouldThrow_WhenUserNotFound()
    {
        var request = new LoginRequestDto("notfound@example.com", "password123");

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync((User?)null);

        Func<Task> act = async () => await _authService.LoginAsync(request);

        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");
    }

    [Fact]
    public async Task LoginAsync_ShouldThrow_WhenPasswordIncorrect()
    {
        var request = new LoginRequestDto("john@example.com", "wrongpassword");

        var passwordHash = BCrypt.Net.BCrypt.HashPassword("correctpassword");
        var user = User.Reconstitute(
            Guid.NewGuid(),
            "John Doe",
            "john@example.com",
            passwordHash,
            "patient",
            null,
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(user);

        Func<Task> act = async () => await _authService.LoginAsync(request);

        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");
    }
}
