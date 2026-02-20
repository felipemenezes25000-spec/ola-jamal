using Xunit;
using FluentAssertions;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.UnitTests.Domain;

// ============================================================
// AuthToken Tests
// ============================================================
public class AuthTokenTests
{
    [Fact]
    public void Create_ShouldCreateValidToken()
    {
        var userId = Guid.NewGuid();
        var token = AuthToken.Create(userId);

        token.Should().NotBeNull();
        token.UserId.Should().Be(userId);
        token.Token.Should().NotBeNullOrEmpty();
        token.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        token.IsExpired().Should().BeFalse();
        token.IsValid().Should().BeTrue();
    }

    [Fact]
    public void Create_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => AuthToken.Create(Guid.Empty);
        act.Should().Throw<DomainException>().WithMessage("User ID is required");
    }

    [Fact]
    public void Create_ShouldRespectCustomExpiration()
    {
        var token = AuthToken.Create(Guid.NewGuid(), expirationDays: 1);
        token.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(1), TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void IsExpired_ShouldReturnTrue_WhenExpired()
    {
        var token = AuthToken.Reconstitute(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "some-token",
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow.AddDays(-2));

        token.IsExpired().Should().BeTrue();
        token.IsValid().Should().BeFalse();
    }

    [Fact]
    public void Reconstitute_ShouldPreserveAllFields()
    {
        var id = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(5);
        var createdAt = DateTime.UtcNow.AddDays(-1);

        var token = AuthToken.Reconstitute(id, userId, "my-token", expiresAt, createdAt);

        token.Id.Should().Be(id);
        token.UserId.Should().Be(userId);
        token.Token.Should().Be("my-token");
        token.ExpiresAt.Should().Be(expiresAt);
        token.CreatedAt.Should().Be(createdAt);
    }

    [Fact]
    public void Create_ShouldGenerateUniqueTokens()
    {
        var userId = Guid.NewGuid();
        var t1 = AuthToken.Create(userId);
        var t2 = AuthToken.Create(userId);
        t1.Token.Should().NotBe(t2.Token);
    }
}

// ============================================================
// DoctorProfile Tests
// ============================================================
public class DoctorProfileTests
{
    [Fact]
    public void Create_ShouldCreateValidProfile()
    {
        var userId = Guid.NewGuid();
        var profile = DoctorProfile.Create(userId, "123456", "SP", "Cardiologia", "Bio");

        profile.Should().NotBeNull();
        profile.UserId.Should().Be(userId);
        profile.Crm.Should().Be("123456");
        profile.CrmState.Should().Be("SP");
        profile.Specialty.Should().Be("Cardiologia");
        profile.Bio.Should().Be("Bio");
        profile.Rating.Should().Be(5.0m);
        profile.TotalConsultations.Should().Be(0);
        profile.Available.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => DoctorProfile.Create(Guid.Empty, "123", "SP", "Clínica");
        act.Should().Throw<DomainException>().WithMessage("User ID is required");
    }

    [Fact]
    public void Create_ShouldThrow_WhenCrmEmpty()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "", "SP", "Clínica");
        act.Should().Throw<DomainException>().WithMessage("CRM is required");
    }

    [Fact]
    public void Create_ShouldThrow_WhenCrmTooLong()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), new string('1', 21), "SP", "Clínica");
        act.Should().Throw<DomainException>().WithMessage("CRM cannot exceed 20 characters");
    }

    [Fact]
    public void Create_ShouldThrow_WhenCrmStateInvalid()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "123", "S", "Clínica");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenCrmStateHasNumbers()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "123", "S1", "Clínica");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenSpecialtyEmpty()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "");
        act.Should().Throw<DomainException>().WithMessage("Specialty is required");
    }

    [Fact]
    public void Create_ShouldThrow_WhenSpecialtyTooLong()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "123", "SP", new string('A', 101));
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenBioTooLong()
    {
        Action act = () => DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica", new string('B', 5001));
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldAcceptNullBio()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        p.Bio.Should().BeNull();
    }

    [Fact]
    public void UpdateProfile_ShouldUpdateBioAndSpecialty()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica", "Old bio");
        p.UpdateProfile("New bio", "Dermatologia");
        p.Bio.Should().Be("New bio");
        p.Specialty.Should().Be("Dermatologia");
    }

    [Fact]
    public void UpdateProfile_ShouldThrow_WhenBioTooLong()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        Action act = () => p.UpdateProfile(new string('X', 5001));
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void SetAvailability_ShouldToggle()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        p.Available.Should().BeFalse();
        p.SetAvailability(true);
        p.Available.Should().BeTrue();
        p.SetAvailability(false);
        p.Available.Should().BeFalse();
    }

    [Fact]
    public void IncrementConsultations_ShouldIncrement()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        p.TotalConsultations.Should().Be(0);
        p.IncrementConsultations();
        p.TotalConsultations.Should().Be(1);
        p.IncrementConsultations();
        p.TotalConsultations.Should().Be(2);
    }

    [Fact]
    public void UpdateRating_ShouldUpdateValidRating()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        p.UpdateRating(4.5m);
        p.Rating.Should().Be(4.5m);
    }

    [Fact]
    public void UpdateRating_ShouldThrow_WhenOutOfRange()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        Action act1 = () => p.UpdateRating(-1);
        Action act2 = () => p.UpdateRating(6);
        act1.Should().Throw<DomainException>();
        act2.Should().Throw<DomainException>();
    }

    [Fact]
    public void SetActiveCertificate_ShouldSetAndClear()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        var certId = Guid.NewGuid();
        p.SetActiveCertificate(certId);
        p.ActiveCertificateId.Should().Be(certId);
        p.ClearActiveCertificate();
        p.ActiveCertificateId.Should().BeNull();
    }

    [Fact]
    public void MarkCrmAsValidated_ShouldSetFields()
    {
        var p = DoctorProfile.Create(Guid.NewGuid(), "123", "SP", "Clínica");
        p.CrmValidated.Should().BeFalse();
        p.MarkCrmAsValidated();
        p.CrmValidated.Should().BeTrue();
        p.CrmValidatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }
}

// ============================================================
// DoctorCertificate Tests
// ============================================================
public class DoctorCertificateTests
{
    private static DoctorCertificate CreateValid() =>
        DoctorCertificate.Create(
            Guid.NewGuid(), "CN=MEDICO", "ICP-Brasil", "ABC123",
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddYears(1),
            "certificates/cert.pfx", "cert.pfx", "12345678901", "123456");

    [Fact]
    public void Create_ShouldCreateValidCertificate()
    {
        var cert = CreateValid();
        cert.Should().NotBeNull();
        cert.IsValid.Should().BeTrue();
        cert.IsRevoked.Should().BeFalse();
        cert.IsExpired.Should().BeFalse();
        cert.IsReadyForSigning().Should().BeTrue();
    }

    [Fact]
    public void Create_ShouldThrow_WhenDoctorProfileIdEmpty()
    {
        Action act = () => DoctorCertificate.Create(
            Guid.Empty, "CN=X", "ICP", "123",
            DateTime.UtcNow, DateTime.UtcNow.AddYears(1), "path", "file");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenSubjectEmpty()
    {
        Action act = () => DoctorCertificate.Create(
            Guid.NewGuid(), "", "ICP", "123",
            DateTime.UtcNow, DateTime.UtcNow.AddYears(1), "path", "file");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenStoragePathEmpty()
    {
        Action act = () => DoctorCertificate.Create(
            Guid.NewGuid(), "CN=X", "ICP", "123",
            DateTime.UtcNow, DateTime.UtcNow.AddYears(1), "", "file");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenExpired()
    {
        Action act = () => DoctorCertificate.Create(
            Guid.NewGuid(), "CN=X", "ICP", "123",
            DateTime.UtcNow.AddYears(-2), DateTime.UtcNow.AddDays(-1), "path", "file");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Revoke_ShouldMarkAsRevoked()
    {
        var cert = CreateValid();
        cert.Revoke("Compromised");
        cert.IsRevoked.Should().BeTrue();
        cert.IsValid.Should().BeFalse();
        cert.RevocationReason.Should().Be("Compromised");
        cert.RevokedAt.Should().NotBeNull();
        cert.IsReadyForSigning().Should().BeFalse();
    }

    [Fact]
    public void Revoke_ShouldBeIdempotent()
    {
        var cert = CreateValid();
        cert.Revoke("First");
        var revokedAt = cert.RevokedAt;
        cert.Revoke("Second");
        cert.RevokedAt.Should().Be(revokedAt);
        cert.RevocationReason.Should().Be("First");
    }

    [Fact]
    public void UpdateValidation_ShouldUpdateFields()
    {
        var cert = CreateValid();
        cert.UpdateValidation(false, "Failed CRL check");
        cert.IsValid.Should().BeFalse();
        cert.LastValidationResult.Should().Be("Failed CRL check");
        cert.LastValidationDate.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsValidatedAtRegistration_ShouldSetFields()
    {
        var cert = CreateValid();
        cert.MarkAsValidatedAtRegistration("OK");
        cert.ValidatedAtRegistration.Should().BeTrue();
        cert.LastValidationResult.Should().Be("OK");
    }

    [Fact]
    public void GetRemainingValidity_ShouldReturnPositiveTimeSpan()
    {
        var cert = CreateValid();
        cert.GetRemainingValidity().Should().NotBeNull();
        cert.GetRemainingValidity()!.Value.TotalDays.Should().BeGreaterThan(0);
    }

    [Fact]
    public void ExtractDoctorName_ShouldExtractFromCN()
    {
        var cert = DoctorCertificate.Create(
            Guid.NewGuid(), "CN=JOAO DA SILVA, OU=CRM, O=ICP-Brasil", "ICP", "123",
            DateTime.UtcNow, DateTime.UtcNow.AddYears(1), "path", "file");
        cert.ExtractDoctorName().Should().Be("JOAO DA SILVA");
    }

    [Fact]
    public void IsReadyForSigning_ShouldBeFalse_WhenInvalid()
    {
        var cert = CreateValid();
        cert.UpdateValidation(false);
        cert.IsReadyForSigning().Should().BeFalse();
    }
}

// ============================================================
// Notification Tests
// ============================================================
public class NotificationTests
{
    [Fact]
    public void Create_ShouldCreateValidNotification()
    {
        var userId = Guid.NewGuid();
        var n = Notification.Create(userId, "Title", "Message");
        n.UserId.Should().Be(userId);
        n.Title.Should().Be("Title");
        n.Message.Should().Be("Message");
        n.NotificationType.Should().Be(NotificationType.Info);
        n.Read.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => Notification.Create(Guid.Empty, "T", "M");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenTitleEmpty()
    {
        Action act = () => Notification.Create(Guid.NewGuid(), "", "M");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenMessageEmpty()
    {
        Action act = () => Notification.Create(Guid.NewGuid(), "T", "");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldAcceptCustomType()
    {
        var n = Notification.Create(Guid.NewGuid(), "T", "M", NotificationType.Warning);
        n.NotificationType.Should().Be(NotificationType.Warning);
    }

    [Fact]
    public void Create_ShouldAcceptData()
    {
        var data = new Dictionary<string, object> { ["key"] = "value" };
        var n = Notification.Create(Guid.NewGuid(), "T", "M", data: data);
        n.Data.Should().ContainKey("key");
    }

    [Fact]
    public void MarkAsRead_ShouldSetReadTrue()
    {
        var n = Notification.Create(Guid.NewGuid(), "T", "M");
        n.Read.Should().BeFalse();
        n.MarkAsRead();
        n.Read.Should().BeTrue();
    }
}

// ============================================================
// PasswordResetToken Tests
// ============================================================
public class PasswordResetTokenTests
{
    [Fact]
    public void Create_ShouldCreateValidToken()
    {
        var userId = Guid.NewGuid();
        var token = PasswordResetToken.Create(userId);
        token.UserId.Should().Be(userId);
        token.Token.Should().NotBeNullOrEmpty();
        token.Used.Should().BeFalse();
        token.IsValid().Should().BeTrue();
    }

    [Fact]
    public void Create_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => PasswordResetToken.Create(Guid.Empty);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldGenerateUrlSafeToken()
    {
        var token = PasswordResetToken.Create(Guid.NewGuid());
        token.Token.Should().NotContain("+");
        token.Token.Should().NotContain("/");
        token.Token.Should().NotContain("=");
    }

    [Fact]
    public void MarkAsUsed_ShouldInvalidate()
    {
        var token = PasswordResetToken.Create(Guid.NewGuid());
        token.MarkAsUsed();
        token.Used.Should().BeTrue();
        token.IsValid().Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldRespectCustomExpiration()
    {
        var token = PasswordResetToken.Create(Guid.NewGuid(), expirationHours: 24);
        token.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddHours(24), TimeSpan.FromSeconds(5));
    }
}

// ============================================================
// VideoRoom Tests
// ============================================================
public class VideoRoomTests
{
    [Fact]
    public void Create_ShouldCreateValidRoom()
    {
        var requestId = Guid.NewGuid();
        var room = VideoRoom.Create(requestId, "room-123");
        room.RequestId.Should().Be(requestId);
        room.RoomName.Should().Be("room-123");
        room.Status.Should().Be(VideoRoomStatus.Waiting);
        room.RoomUrl.Should().BeNull();
        room.StartedAt.Should().BeNull();
        room.EndedAt.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldThrow_WhenRequestIdEmpty()
    {
        Action act = () => VideoRoom.Create(Guid.Empty, "room");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenRoomNameEmpty()
    {
        Action act = () => VideoRoom.Create(Guid.NewGuid(), "");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void SetRoomUrl_ShouldSetUrl()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        room.SetRoomUrl("https://meet.example.com/room");
        room.RoomUrl.Should().Be("https://meet.example.com/room");
    }

    [Fact]
    public void SetRoomUrl_ShouldThrow_WhenEmpty()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        Action act = () => room.SetRoomUrl("");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Start_ShouldChangeToActive()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        room.Start();
        room.Status.Should().Be(VideoRoomStatus.Active);
        room.StartedAt.Should().NotBeNull();
    }

    [Fact]
    public void Start_ShouldThrow_WhenNotWaiting()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        room.Start();
        Action act = () => room.Start();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void End_ShouldChangeToEnded()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        room.Start();
        room.End();
        room.Status.Should().Be(VideoRoomStatus.Ended);
        room.EndedAt.Should().NotBeNull();
        room.DurationSeconds.Should().NotBeNull();
        room.DurationSeconds.Should().BeGreaterOrEqualTo(0);
    }

    [Fact]
    public void End_ShouldThrow_WhenNotActive()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        Action act = () => room.End();
        act.Should().Throw<DomainException>();
    }
}

// ============================================================
// PushToken Tests
// ============================================================
public class PushTokenTests
{
    [Fact]
    public void Create_ShouldCreateValidToken()
    {
        var userId = Guid.NewGuid();
        var pt = PushToken.Create(userId, "ExponentPushToken[abc123]", "android");
        pt.UserId.Should().Be(userId);
        pt.Token.Should().Be("ExponentPushToken[abc123]");
        pt.DeviceType.Should().Be("android");
        pt.Active.Should().BeTrue();
    }

    [Fact]
    public void Create_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => PushToken.Create(Guid.Empty, "token");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_WhenTokenEmpty()
    {
        Action act = () => PushToken.Create(Guid.NewGuid(), "");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldDefaultDeviceType()
    {
        var pt = PushToken.Create(Guid.NewGuid(), "token");
        pt.DeviceType.Should().Be("unknown");
    }

    [Fact]
    public void Deactivate_ShouldSetInactive()
    {
        var pt = PushToken.Create(Guid.NewGuid(), "token");
        pt.Deactivate();
        pt.Active.Should().BeFalse();
    }

    [Fact]
    public void Activate_ShouldSetActive()
    {
        var pt = PushToken.Create(Guid.NewGuid(), "token");
        pt.Deactivate();
        pt.Activate();
        pt.Active.Should().BeTrue();
    }
}

// ============================================================
// AuditLog Tests
// ============================================================
public class AuditLogTests
{
    [Fact]
    public void Create_ShouldCreateValidLog()
    {
        var log = AuditLog.Create(Guid.NewGuid(), "Read", "Request", Guid.NewGuid());
        log.Action.Should().Be("Read");
        log.EntityType.Should().Be("Request");
    }

    [Fact]
    public void Create_ShouldAcceptNullUserId()
    {
        var log = AuditLog.Create(null, "Verify", "Request");
        log.UserId.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldAcceptMetadata()
    {
        var meta = new Dictionary<string, object?> { ["endpoint"] = "/api/requests", ["method"] = "GET" };
        var log = AuditLog.Create(Guid.NewGuid(), "Read", "Request", metadata: meta);
        log.Metadata.Should().ContainKey("endpoint");
    }

    [Fact]
    public void Reconstitute_ShouldPreserveAllFields()
    {
        var id = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var entityId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddHours(-1);

        var log = AuditLog.Reconstitute(
            id, userId, "Update", "Payment", entityId,
            null, null, "127.0.0.1", "Mozilla", "corr-123", null, createdAt);

        log.Id.Should().Be(id);
        log.UserId.Should().Be(userId);
        log.Action.Should().Be("Update");
        log.EntityId.Should().Be(entityId);
        log.IpAddress.Should().Be("127.0.0.1");
        log.CorrelationId.Should().Be("corr-123");
        log.CreatedAt.Should().Be(createdAt);
    }
}

// ============================================================
// Phone Value Object Tests
// ============================================================
public class PhoneTests
{
    [Fact]
    public void Create_ShouldCreateValid10Digits()
    {
        var phone = Phone.Create("1133334444");
        phone.Value.Should().Be("1133334444");
    }

    [Fact]
    public void Create_ShouldCreateValid11Digits()
    {
        var phone = Phone.Create("11987654321");
        phone.Value.Should().Be("11987654321");
    }

    [Fact]
    public void Create_ShouldThrow_WhenEmpty()
    {
        Action act = () => Phone.Create("");
        act.Should().Throw<DomainException>().WithMessage("Phone cannot be empty");
    }

    [Fact]
    public void Create_ShouldThrow_WhenHasLetters()
    {
        Action act = () => Phone.Create("11abc654321");
        act.Should().Throw<DomainException>().WithMessage("Phone must contain only numbers");
    }

    [Fact]
    public void Create_ShouldThrow_WhenTooShort()
    {
        Action act = () => Phone.Create("123456789");
        act.Should().Throw<DomainException>().WithMessage("Phone must have 10 or 11 digits");
    }

    [Fact]
    public void Create_ShouldThrow_WhenTooLong()
    {
        Action act = () => Phone.Create("123456789012");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Equality_ShouldWork()
    {
        var p1 = Phone.Create("11987654321");
        var p2 = Phone.Create("11987654321");
        p1.Should().Be(p2);
        p1.Equals(p2).Should().BeTrue();
        p1.GetHashCode().Should().Be(p2.GetHashCode());
    }

    [Fact]
    public void ImplicitConversion_ShouldWork()
    {
        var phone = Phone.Create("11987654321");
        string value = phone;
        value.Should().Be("11987654321");
    }
}

// ============================================================
// Extended User Tests
// ============================================================
public class ExtendedUserTests
{
    [Fact]
    public void CreatePatient_ShouldThrow_WhenSingleName()
    {
        Action act = () => User.CreatePatient("John", "j@e.com", "hash", "12345678901", "11987654321");
        act.Should().Throw<DomainException>().WithMessage("Name must contain at least two words");
    }

    [Fact]
    public void CreatePatient_ShouldThrow_WhenEmptyPassword()
    {
        Action act = () => User.CreatePatient("John Doe", "j@e.com", "", "12345678901", "11987654321");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreatePatient_ShouldThrow_WhenInvalidCpf()
    {
        Action act = () => User.CreatePatient("John Doe", "j@e.com", "hash", "123", "11987654321");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreateFromGoogleIdentity_ShouldCreateIncompleteProfile()
    {
        var user = User.CreateFromGoogleIdentity("Google User", "g@gmail.com", "hash");
        user.ProfileComplete.Should().BeFalse();
        user.Role.Should().Be(UserRole.Patient);
        user.Phone.Should().BeNull();
        user.Cpf.Should().BeNull();
    }

    [Fact]
    public void CreateFromGoogleIdentity_ShouldAcceptDoctorRole()
    {
        var user = User.CreateFromGoogleIdentity("Dr Google", "dr@gmail.com", "hash", UserRole.Doctor);
        user.Role.Should().Be(UserRole.Doctor);
        user.ProfileComplete.Should().BeFalse();
    }

    [Fact]
    public void CompleteProfile_ShouldMarkComplete()
    {
        var user = User.CreateFromGoogleIdentity("User Test", "u@test.com", "hash");
        user.CompleteProfile("11987654321", "12345678901", new DateTime(1990, 1, 1));
        user.ProfileComplete.Should().BeTrue();
        user.Phone.Should().NotBeNull();
        user.Cpf.Should().Be("12345678901");
    }

    [Fact]
    public void UpdateProfile_ShouldUpdateFields()
    {
        var user = User.CreatePatient("John Doe", "j@e.com", "hash", "12345678901", "11987654321");
        user.UpdateProfile(name: "John Updated", avatarUrl: "https://avatar.com/john.png");
        user.Name.Should().Be("John Updated");
        user.AvatarUrl.Should().Be("https://avatar.com/john.png");
    }

    [Fact]
    public void UpdatePassword_ShouldThrow_WhenEmpty()
    {
        var user = User.CreatePatient("John Doe", "j@e.com", "hash", "12345678901", "11987654321");
        Action act = () => user.UpdatePassword("");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void MarkProfileIncomplete_ShouldWork()
    {
        var user = User.CreatePatient("John Doe", "j@e.com", "hash", "12345678901", "11987654321");
        user.ProfileComplete.Should().BeTrue();
        user.MarkProfileIncomplete();
        user.ProfileComplete.Should().BeFalse();
        user.MarkProfileComplete();
        user.ProfileComplete.Should().BeTrue();
    }

    [Fact]
    public void Reconstitute_ShouldPreserveAllFields()
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var user = User.Reconstitute(id, "Test User", "t@e.com", "hash", "doctor",
            "11987654321", "12345678901", new DateTime(1985, 5, 10), "avatar.jpg", now, now, false);

        user.Id.Should().Be(id);
        user.Name.Should().Be("Test User");
        user.Role.Should().Be(UserRole.Doctor);
        user.ProfileComplete.Should().BeFalse();
        user.AvatarUrl.Should().Be("avatar.jpg");
    }
}

// ============================================================
// Extended MedicalRequest Tests (state machine)
// ============================================================
public class ExtendedMedicalRequestTests
{
    [Fact]
    public void CreateExam_ShouldCreateValidRequest()
    {
        var r = MedicalRequest.CreateExam(Guid.NewGuid(), "Patient",
            "sangue", new List<string> { "Hemograma" }, "Febre persistente");
        r.RequestType.Should().Be(RequestType.Exam);
        r.Status.Should().Be(RequestStatus.Submitted);
        r.ExamType.Should().Be("sangue");
        r.Exams.Should().Contain("Hemograma");
        r.Symptoms.Should().Be("Febre persistente");
        r.AccessCode.Should().HaveLength(4);
    }

    [Fact]
    public void CreateExam_ShouldThrow_WhenNoDataProvided()
    {
        Action act = () => MedicalRequest.CreateExam(Guid.NewGuid(), "Patient",
            "geral", new List<string>(), null, new List<string>());
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreateConsultation_ShouldStartAsSearchingDoctor()
    {
        var r = MedicalRequest.CreateConsultation(Guid.NewGuid(), "Patient", "Dor de cabeça");
        r.RequestType.Should().Be(RequestType.Consultation);
        r.Status.Should().Be(RequestStatus.SearchingDoctor);
        r.Symptoms.Should().Be("Dor de cabeça");
    }

    [Fact]
    public void CreateConsultation_ShouldThrow_WhenSymptomsEmpty()
    {
        Action act = () => MedicalRequest.CreateConsultation(Guid.NewGuid(), "Patient", "");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreatePrescription_ShouldThrow_WhenPatientIdEmpty()
    {
        Action act = () => MedicalRequest.CreatePrescription(Guid.Empty, "P", PrescriptionType.Simple, new List<string>());
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void AssignDoctor_ShouldSetDoctorAndStatus()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        var doctorId = Guid.NewGuid();
        r.AssignDoctor(doctorId, "Dr. Smith");
        r.DoctorId.Should().Be(doctorId);
        r.DoctorName.Should().Be("Dr. Smith");
        r.Status.Should().Be(RequestStatus.InReview);
    }

    [Fact]
    public void AssignDoctor_ShouldThrow_WhenDoctorIdEmpty()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.AssignDoctor(Guid.Empty, "Dr.");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Approve_ShouldThrow_WhenPriceZero()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.Approve(0);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Approve_ShouldUpdateMedicationsAndExams()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "Old" });
        r.Approve(50, medications: new List<string> { "New1", "New2" });
        r.Medications.Should().HaveCount(2);
        r.Medications.Should().Contain("New1");
    }

    [Fact]
    public void MarkAsPaid_ShouldThrow_WhenNotPendingPayment()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.MarkAsPaid();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Sign_ShouldThrow_WhenNotPaid()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.Sign("url", "sig");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Sign_ShouldThrow_WhenUrlEmpty()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        r.Approve(50);
        r.MarkAsPaid();
        Action act = () => r.Sign("", "sig");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void FullPrescriptionFlow_ShouldTransitionCorrectly()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Controlled, new List<string> { "Med" });
        r.Status.Should().Be(RequestStatus.Submitted);

        r.AssignDoctor(Guid.NewGuid(), "Dr.");
        r.Status.Should().Be(RequestStatus.InReview);

        r.Approve(100);
        r.Status.Should().Be(RequestStatus.ApprovedPendingPayment);

        r.MarkAsPaid();
        r.Status.Should().Be(RequestStatus.Paid);

        r.Sign("https://storage/signed.pdf", "sig-123");
        r.Status.Should().Be(RequestStatus.Signed);
        r.SignedDocumentUrl.Should().Be("https://storage/signed.pdf");
        r.SignatureId.Should().Be("sig-123");
        r.SignedAt.Should().NotBeNull();

        r.Deliver();
        r.Status.Should().Be(RequestStatus.Delivered);
    }

    [Fact]
    public void Deliver_ShouldThrow_WhenNotSigned()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.Deliver();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Reject_ShouldThrow_WhenReasonEmpty()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.Reject("");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Cancel_ShouldSetCancelled()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        r.Cancel();
        r.Status.Should().Be(RequestStatus.Cancelled);
    }

    [Fact]
    public void ConsultationFlow_ShouldTransitionCorrectly()
    {
        var r = MedicalRequest.CreateConsultation(Guid.NewGuid(), "P", "Sintomas");
        r.Status.Should().Be(RequestStatus.SearchingDoctor);

        r.MarkConsultationReady();
        r.Status.Should().Be(RequestStatus.ConsultationReady);

        r.StartConsultation();
        r.Status.Should().Be(RequestStatus.InConsultation);

        r.FinishConsultation("Paciente está bem.");
        r.Status.Should().Be(RequestStatus.ConsultationFinished);
        r.Notes.Should().Be("Paciente está bem.");
    }

    [Fact]
    public void MarkConsultationReady_ShouldThrow_WhenNotConsultation()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.MarkConsultationReady();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void StartConsultation_ShouldThrow_WhenNotConsultation()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.StartConsultation();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void FinishConsultation_ShouldThrow_WhenNotConsultation()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.FinishConsultation();
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void SetAiAnalysis_ShouldSetAllFields()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        r.SetAiAnalysis("Summary", "{\"meds\":[]}", "medium", "low", true, "Receita legível");
        r.AiSummaryForDoctor.Should().Be("Summary");
        r.AiExtractedJson.Should().Be("{\"meds\":[]}");
        r.AiRiskLevel.Should().Be("medium");
        r.AiUrgency.Should().Be("low");
        r.AiReadabilityOk.Should().BeTrue();
        r.AiMessageToUser.Should().Be("Receita legível");
    }

    [Fact]
    public void UpdatePrescriptionContent_ShouldThrow_WhenNotPrescription()
    {
        var r = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "geral", new List<string> { "Ex" }, "Symptoms");
        Action act = () => r.UpdatePrescriptionContent(new List<string> { "Med" });
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void UpdateExamContent_ShouldThrow_WhenNotExam()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        Action act = () => r.UpdateExamContent(new List<string> { "Exam" });
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void AccessCode_ShouldBe4Digits()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        r.AccessCode.Should().NotBeNull();
        r.AccessCode.Should().HaveLength(4);
        int.TryParse(r.AccessCode, out _).Should().BeTrue();
    }

    [Fact]
    public void Reconstitute_ShouldPreserveAllFields()
    {
        var id = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var r = MedicalRequest.Reconstitute(
            id, patientId, "Patient", doctorId, "Doctor",
            "Prescription", "Paid", "Simple",
            new List<string> { "Med1" }, new List<string> { "img.jpg" },
            null, null, null, "Headache", 100.00m, "Notes", null,
            now, "https://signed.pdf", "sig-id", now, now,
            "AI Summary", "{}", "low", null, true, "OK", "1234");

        r.Id.Should().Be(id);
        r.PatientId.Should().Be(patientId);
        r.DoctorId.Should().Be(doctorId);
        r.Status.Should().Be(RequestStatus.Paid);
        r.PrescriptionType.Should().Be(PrescriptionType.Simple);
        r.AccessCode.Should().Be("1234");
    }
}

// ============================================================
// Extended Payment Tests
// ============================================================
public class ExtendedPaymentTests
{
    [Fact]
    public void CreatePixPayment_ShouldThrow_WhenRequestIdEmpty()
    {
        Action act = () => Payment.CreatePixPayment(Guid.Empty, Guid.NewGuid(), 100);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreatePixPayment_ShouldThrow_WhenUserIdEmpty()
    {
        Action act = () => Payment.CreatePixPayment(Guid.NewGuid(), Guid.Empty, 100);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void CreateCardPayment_ShouldCreateCreditCard()
    {
        var p = Payment.CreateCardPayment(Guid.NewGuid(), Guid.NewGuid(), 50, "credit_card");
        p.PaymentMethod.Should().Be("credit_card");
        p.Status.Should().Be(PaymentStatus.Pending);
    }

    [Fact]
    public void CreateCardPayment_ShouldCreateDebitCard()
    {
        var p = Payment.CreateCardPayment(Guid.NewGuid(), Guid.NewGuid(), 50, "debit_card");
        p.PaymentMethod.Should().Be("debit_card");
    }

    [Fact]
    public void CreateCardPayment_ShouldThrow_WhenInvalidMethod()
    {
        Action act = () => Payment.CreateCardPayment(Guid.NewGuid(), Guid.NewGuid(), 50, "boleto");
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Reject_ShouldSetRejected()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.Reject();
        p.Status.Should().Be(PaymentStatus.Rejected);
    }

    [Fact]
    public void IsPending_ShouldReturnCorrectly()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.IsPending().Should().BeTrue();
        p.Approve();
        p.IsPending().Should().BeFalse();
    }
}
