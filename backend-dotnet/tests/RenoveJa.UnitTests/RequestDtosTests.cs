using Xunit;
using FluentAssertions;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.UnitTests.DTOs;

/// <summary>
/// Testes dos DTOs por bounded context (DDD).
/// Garante que a separação RequestDtos, PaymentDtos, etc. está correta.
/// </summary>
public class RequestDtosTests
{
    [Fact]
    public void RequestResponseDto_ShouldBeCreatable()
    {
        var now = DateTime.UtcNow;
        var dto = new RequestResponseDto(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Patient",
            Guid.NewGuid(),
            "Doctor",
            "prescription",
            "submitted",
            "simple",
            new List<string> { "Med1" },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            now,
            now);

        dto.RequestType.Should().Be("prescription");
        dto.Status.Should().Be("submitted");
        dto.Medications.Should().HaveCount(1);
    }
}
