using Xunit;
using FluentAssertions;
using RenoveJa.Application.Helpers;
using RenoveJa.Domain.Enums;

namespace RenoveJa.UnitTests.Helpers;

// ============================================================
// EnumHelper Tests
// ============================================================
public class EnumHelperTests
{
    [Theory]
    [InlineData(RequestStatus.InReview, "in_review")]
    [InlineData(RequestStatus.ApprovedPendingPayment, "approved_pending_payment")]
    [InlineData(RequestStatus.Submitted, "submitted")]
    [InlineData(RequestStatus.Paid, "paid")]
    [InlineData(RequestStatus.Signed, "signed")]
    [InlineData(RequestStatus.Delivered, "delivered")]
    [InlineData(RequestStatus.Rejected, "rejected")]
    [InlineData(RequestStatus.SearchingDoctor, "searching_doctor")]
    [InlineData(RequestStatus.ConsultationReady, "consultation_ready")]
    [InlineData(RequestStatus.InConsultation, "in_consultation")]
    [InlineData(RequestStatus.ConsultationFinished, "consultation_finished")]
    [InlineData(RequestStatus.Cancelled, "cancelled")]
    public void ToSnakeCase_ShouldConvertRequestStatus(RequestStatus status, string expected)
    {
        EnumHelper.ToSnakeCase(status).Should().Be(expected);
    }

    [Theory]
    [InlineData(RequestType.Prescription, "prescription")]
    [InlineData(RequestType.Exam, "exam")]
    [InlineData(RequestType.Consultation, "consultation")]
    public void ToSnakeCase_ShouldConvertRequestType(RequestType type, string expected)
    {
        EnumHelper.ToSnakeCase(type).Should().Be(expected);
    }

    [Theory]
    [InlineData(PaymentStatus.Pending, "pending")]
    [InlineData(PaymentStatus.Approved, "approved")]
    [InlineData(PaymentStatus.Rejected, "rejected")]
    [InlineData(PaymentStatus.Refunded, "refunded")]
    public void ToSnakeCase_ShouldConvertPaymentStatus(PaymentStatus status, string expected)
    {
        EnumHelper.ToSnakeCase(status).Should().Be(expected);
    }

    [Theory]
    [InlineData("in_review", RequestStatus.InReview)]
    [InlineData("approved_pending_payment", RequestStatus.ApprovedPendingPayment)]
    [InlineData("submitted", RequestStatus.Submitted)]
    [InlineData("searching_doctor", RequestStatus.SearchingDoctor)]
    [InlineData("consultation_ready", RequestStatus.ConsultationReady)]
    [InlineData("in_consultation", RequestStatus.InConsultation)]
    [InlineData("consultation_finished", RequestStatus.ConsultationFinished)]
    public void ParseSnakeCase_ShouldParseRequestStatus(string input, RequestStatus expected)
    {
        EnumHelper.ParseSnakeCase<RequestStatus>(input).Should().Be(expected);
    }

    [Theory]
    [InlineData("InReview", RequestStatus.InReview)]
    [InlineData("Submitted", RequestStatus.Submitted)]
    [InlineData("Paid", RequestStatus.Paid)]
    public void ParseSnakeCase_ShouldParsePascalCase(string input, RequestStatus expected)
    {
        EnumHelper.ParseSnakeCase<RequestStatus>(input).Should().Be(expected);
    }

    [Fact]
    public void ParseSnakeCase_ShouldThrow_WhenInvalidValue()
    {
        Action act = () => EnumHelper.ParseSnakeCase<RequestStatus>("nonexistent");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ParseSnakeCase_ShouldThrow_WhenEmpty()
    {
        Action act = () => EnumHelper.ParseSnakeCase<RequestStatus>("");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void PascalToSnakeCase_ShouldHandleEmptyString()
    {
        EnumHelper.PascalToSnakeCase("").Should().Be("");
    }

    [Fact]
    public void PascalToSnakeCase_ShouldHandleSingleWord()
    {
        EnumHelper.PascalToSnakeCase("Submitted").Should().Be("submitted");
    }

    [Fact]
    public void Roundtrip_ShouldWork()
    {
        foreach (var status in Enum.GetValues<RequestStatus>())
        {
            var snake = EnumHelper.ToSnakeCase(status);
            var parsed = EnumHelper.ParseSnakeCase<RequestStatus>(snake);
            parsed.Should().Be(status, $"roundtrip failed for {status}");
        }
    }
}

// ============================================================
// CpfHelper Tests
// ============================================================
public class CpfHelperTests
{
    [Theory]
    [InlineData("52998224725", true)]   // Valid CPF
    [InlineData("11144477735", true)]   // Valid CPF
    [InlineData("12345678909", true)]   // Valid CPF
    [InlineData("11111111111", false)]  // All same digits
    [InlineData("00000000000", false)]  // All zeros
    [InlineData("12345678901", false)]  // Invalid check digit
    [InlineData("123", false)]          // Too short
    [InlineData("", false)]             // Empty
    public void IsValid_ShouldValidateCorrectly(string cpf, bool expected)
    {
        CpfHelper.IsValid(cpf).Should().Be(expected);
    }

    [Fact]
    public void IsValid_ShouldReturnFalse_WhenNull()
    {
        CpfHelper.IsValid(null!).Should().BeFalse();
    }

    [Theory]
    [InlineData("529.982.247-25", "52998224725")]
    [InlineData("111.444.777-35", "11144477735")]
    [InlineData("  123.456.789-09  ", "12345678909")]
    public void ExtractDigits_ShouldExtract11Digits(string input, string expected)
    {
        CpfHelper.ExtractDigits(input).Should().Be(expected);
    }

    [Fact]
    public void ExtractDigits_ShouldReturnPartial_WhenTooFew()
    {
        CpfHelper.ExtractDigits("123").Should().Be("123");
    }

    [Fact]
    public void ExtractDigits_ShouldReturnEmpty_WhenNull()
    {
        CpfHelper.ExtractDigits(null).Should().BeEmpty();
    }

    [Fact]
    public void ExtractDigits_ShouldReturnEmpty_WhenEmpty()
    {
        CpfHelper.ExtractDigits("").Should().BeEmpty();
    }

    [Fact]
    public void IsValidForPayment_ShouldReturnTrue_WhenFormattedValid()
    {
        CpfHelper.IsValidForPayment("529.982.247-25").Should().BeTrue();
    }

    [Fact]
    public void IsValidForPayment_ShouldReturnFalse_WhenInvalid()
    {
        CpfHelper.IsValidForPayment("111.111.111-11").Should().BeFalse();
    }

    [Fact]
    public void IsValidForPayment_ShouldReturnFalse_WhenNull()
    {
        CpfHelper.IsValidForPayment(null).Should().BeFalse();
    }
}
