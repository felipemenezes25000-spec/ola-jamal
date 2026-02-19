using FluentAssertions;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Enums;
using Xunit;

namespace RenoveJa.UnitTests;

public class PrescriptionComplianceValidatorTests
{
    [Fact]
    public void ValidateSimple_WithAllFields_ReturnsValid()
    {
        var result = PrescriptionComplianceValidator.ValidateSimple(
            "João Silva",
            new List<string> { "Dipirona 500mg" },
            "Dr. Maria",
            "123456",
            "SP",
            "Rua X, 100",
            "11999999999");

        result.IsValid.Should().BeTrue();
        result.MissingFields.Should().BeEmpty();
        result.Messages.Should().BeEmpty();
    }

    [Fact]
    public void ValidateSimple_MissingPatientName_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateSimple(
            null,
            new List<string> { "Med" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel");

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("paciente.nome");
        result.Messages.Should().Contain(m => m.Contains("Nome do paciente"));
    }

    [Fact]
    public void ValidateSimple_MissingDoctorAddress_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateSimple(
            "João",
            new List<string> { "Med" },
            "Dr. Maria",
            "123456",
            "SP",
            null,
            "11999999999");

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("médico.endereço");
    }

    [Fact]
    public void ValidateAntimicrobial_MissingPatientGender_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateAntimicrobial(
            "João",
            new List<string> { "Amoxicilina" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel",
            null,
            new DateTime(1990, 1, 1));

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("paciente.sexo");
    }

    [Fact]
    public void ValidateAntimicrobial_MissingPatientBirthDate_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateAntimicrobial(
            "João",
            new List<string> { "Amoxicilina" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel",
            "M",
            null);

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("paciente.data_nascimento");
    }

    [Fact]
    public void ValidateAntimicrobial_WithAllFields_ReturnsValid()
    {
        var result = PrescriptionComplianceValidator.ValidateAntimicrobial(
            "João",
            new List<string> { "Amoxicilina 500mg" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel",
            "M",
            new DateTime(1990, 1, 1));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidateControlledSpecial_MissingPatientCpf_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateControlledSpecial(
            "João",
            null,
            "Rua X",
            new List<string> { "Rivotril" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel");

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("paciente.cpf");
    }

    [Fact]
    public void ValidateControlledSpecial_MissingPatientAddress_ReturnsInvalid()
    {
        var result = PrescriptionComplianceValidator.ValidateControlledSpecial(
            "João",
            "12345678901",
            null,
            new List<string> { "Rivotril" },
            "Dr. Maria",
            "123456",
            "SP",
            "End",
            "Tel");

        result.IsValid.Should().BeFalse();
        result.MissingFields.Should().Contain("paciente.endereço");
    }

    [Fact]
    public void ValidateControlledSpecial_WithAllFields_ReturnsValid()
    {
        var result = PrescriptionComplianceValidator.ValidateControlledSpecial(
            "João",
            "12345678901",
            "Rua X, 100",
            new List<string> { "Rivotril 2mg" },
            "Dr. Maria",
            "123456",
            "SP",
            "End médico",
            "11999999999");

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_DispatchesByPrescriptionKind()
    {
        var resultSimple = PrescriptionComplianceValidator.Validate(
            PrescriptionKind.Simple,
            "João", null, null, null, null,
            new List<string> { "Med" },
            "Dr. Maria", "123", "SP", "End", "Tel");
        resultSimple.IsValid.Should().BeTrue();

        var resultAntimicrobial = PrescriptionComplianceValidator.Validate(
            PrescriptionKind.Antimicrobial,
            "João", null, null, null, null,
            new List<string> { "Med" },
            "Dr. Maria", "123", "SP", "End", "Tel");
        resultAntimicrobial.IsValid.Should().BeFalse();
        resultAntimicrobial.MissingFields.Should().Contain("paciente.sexo");
    }
}
