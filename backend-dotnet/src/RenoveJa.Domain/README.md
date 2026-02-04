# RenoveJa.Domain (DDD)

Camada de **Domínio** no padrão DDD (Domain-Driven Design).

## Estrutura

- **Entities**: Entidades e raizes de agregado (`Entity`, `AggregateRoot`)
  - `MedicalRequest` – agregado de solicitação médica (prescrição, exame, consulta)
  - `User` – agregado de identidade (paciente/médico)
  - Demais entidades: `Payment`, `ChatMessage`, `Notification`, `VideoRoom`, `DoctorProfile`, `AuthToken`, `PushToken`
- **ValueObjects**: Objetos de valor (`Email`, `Phone`, `Money`)
- **Enums**: Valores do domínio (`RequestType`, `RequestStatus`, `UserRole`, etc.)
- **Exceptions**: `DomainException`
- **Interfaces**: Contratos de repositórios (implementados na Infrastructure)

## Regras

- O Domain **não** referencia Application nem Infrastructure.
- Toda lógica de negócio e invariantes ficam nas entidades e value objects.
- Repositórios são definidos como interfaces aqui e implementados na camada de infraestrutura.
