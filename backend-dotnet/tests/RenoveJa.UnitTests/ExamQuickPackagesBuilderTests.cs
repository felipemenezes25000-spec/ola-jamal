using FluentAssertions;
using RenoveJa.Application.Services.Clinical;
using Xunit;

namespace RenoveJa.UnitTests;

public class ExamQuickPackagesBuilderTests
{
    [Fact]
    public void Build_FemaleOfChildbearingAge_IncludesPrenatal()
    {
        var birth = DateTime.Today.AddYears(-28).AddDays(-10);
        var packages = ExamQuickPackagesBuilder.Build(birth, "F");
        packages.Should().Contain(p => p.Key == "prenatal");
    }

    [Fact]
    public void Build_Male_DoesNotIncludePrenatal()
    {
        var birth = DateTime.Today.AddYears(-28).AddDays(-10);
        var packages = ExamQuickPackagesBuilder.Build(birth, "M");
        packages.Should().NotContain(p => p.Key == "prenatal");
    }

    [Fact]
    public void Build_Child_UsesPediatricCheckup()
    {
        var birth = DateTime.Today.AddYears(-10);
        var packages = ExamQuickPackagesBuilder.Build(birth, "M");
        packages.Should().Contain(p => p.Key == "checkup_pediatric");
    }

    [Fact]
    public void Build_Male45Plus_CheckupIncludesPsa()
    {
        var birth = DateTime.Today.AddYears(-50);
        var packages = ExamQuickPackagesBuilder.Build(birth, "M");
        var checkup = packages.Should().Contain(p => p.Key == "checkup").Subject;
        checkup.Exams.Should().Contain(e => e.Contains("PSA", StringComparison.OrdinalIgnoreCase));
    }
}
