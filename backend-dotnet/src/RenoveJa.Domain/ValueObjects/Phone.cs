using System.Text.RegularExpressions;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.ValueObjects;

public sealed class Phone : IEquatable<Phone>
{
    private static readonly Regex PhoneRegex = new(
        @"^\+?[\d\s\-\(\)]+$",
        RegexOptions.Compiled
    );

    public string Value { get; }

    private Phone(string value)
    {
        Value = value;
    }

    public static Phone Create(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            throw new DomainException("Phone cannot be empty");

        phone = phone.Trim();

        if (!PhoneRegex.IsMatch(phone))
            throw new DomainException("Invalid phone format");

        return new Phone(phone);
    }

    public bool Equals(Phone? other)
    {
        if (other is null) return false;
        return Value == other.Value;
    }

    public override bool Equals(object? obj) => Equals(obj as Phone);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value;

    public static implicit operator string(Phone phone) => phone.Value;
}
