using Moq;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.UnitTests.Services;

public class DoctorServiceTests
{
    private readonly Mock<IDoctorRepository> _doctorRepoMock;
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly DoctorService _sut;

    public DoctorServiceTests()
    {
        _doctorRepoMock = new Mock<IDoctorRepository>();
        _userRepoMock = new Mock<IUserRepository>();
        _sut = new DoctorService(_doctorRepoMock.Object, _userRepoMock.Object);
    }

    private static DoctorProfile CreateDoctorProfile(Guid? userId = null)
    {
        var uid = userId ?? Guid.NewGuid();
        return DoctorProfile.Create(uid, "123456", "SP", "Clínica Geral", "Bio do médico");
    }

    private static User CreateDoctorUser(Guid? id = null)
    {
        var userId = id ?? Guid.NewGuid();
        return User.Reconstitute(
            userId,
            "Dr. Teste Silva",
            "doctor@example.com",
            "hashedpwd",
            "Doctor",
            "11999887766",
            "12345678901",
            new DateTime(1985, 5, 10),
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    [Fact]
    public async Task GetDoctorsAsync_ShouldReturnList_WhenDoctorsExist()
    {
        // Arrange
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        var profiles = new List<DoctorProfile>
        {
            CreateDoctorProfile(userId1),
            CreateDoctorProfile(userId2)
        };

        var users = new List<User>
        {
            CreateDoctorUser(userId1),
            CreateDoctorUser(userId2)
        };

        _doctorRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profiles);

        _userRepoMock
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        // Act
        var result = await _sut.GetDoctorsAsync(null, null);

        // Assert
        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Dr. Teste Silva");
        result[0].Crm.Should().Be("123456");
        result[0].CrmState.Should().Be("SP");
        result[0].Specialty.Should().Be("Clínica Geral");
    }

    [Fact]
    public async Task GetDoctorsAsync_ShouldReturnEmptyList_WhenNoDoctors()
    {
        // Arrange
        _doctorRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DoctorProfile>());

        // Act
        var result = await _sut.GetDoctorsAsync(null, null);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDoctorsAsync_ShouldFilterBySpecialty()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profiles = new List<DoctorProfile> { CreateDoctorProfile(userId) };
        var users = new List<User> { CreateDoctorUser(userId) };

        _doctorRepoMock
            .Setup(r => r.GetBySpecialtyAsync("Cardiologia", It.IsAny<CancellationToken>()))
            .ReturnsAsync(profiles);

        _userRepoMock
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        // Act
        var result = await _sut.GetDoctorsAsync("Cardiologia", null);

        // Assert
        result.Should().HaveCount(1);
        _doctorRepoMock.Verify(r => r.GetBySpecialtyAsync("Cardiologia", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetDoctorsAsync_ShouldFilterByAvailability()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profiles = new List<DoctorProfile> { CreateDoctorProfile(userId) };
        var users = new List<User> { CreateDoctorUser(userId) };

        _doctorRepoMock
            .Setup(r => r.GetAvailableAsync(null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profiles);

        _userRepoMock
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        // Act
        var result = await _sut.GetDoctorsAsync(null, true);

        // Assert
        result.Should().HaveCount(1);
        _doctorRepoMock.Verify(r => r.GetAvailableAsync(null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetDoctorByIdAsync_ShouldReturnDoctor_WhenFound()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = CreateDoctorProfile(userId);
        var user = CreateDoctorUser(userId);

        _doctorRepoMock
            .Setup(r => r.GetByIdAsync(profile.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _userRepoMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _sut.GetDoctorByIdAsync(profile.Id);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(profile.Id);
        result.Name.Should().Be("Dr. Teste Silva");
        result.Crm.Should().Be("123456");
    }

    [Fact]
    public async Task GetDoctorByIdAsync_ShouldThrowKeyNotFoundException_WhenNotFound()
    {
        // Arrange
        var id = Guid.NewGuid();

        _doctorRepoMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DoctorProfile?)null);

        // Act
        Func<Task> act = () => _sut.GetDoctorByIdAsync(id);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Doctor not found");
    }

    [Fact]
    public async Task GetDoctorByIdAsync_ShouldThrowInvalidOperation_WhenUserNotFound()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = CreateDoctorProfile(userId);

        _doctorRepoMock
            .Setup(r => r.GetByIdAsync(profile.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _userRepoMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Act
        Func<Task> act = () => _sut.GetDoctorByIdAsync(profile.Id);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Doctor user not found");
    }
}
