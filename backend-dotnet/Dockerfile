# ============================================================
# RenoveJá Backend - Multi-stage Dockerfile
# ============================================================

# Stage 1: Restore dependencies
FROM mcr.microsoft.com/dotnet/sdk:8.0.204-bookworm-slim AS restore
WORKDIR /src
COPY backend-dotnet/ .
RUN dotnet restore

# Stage 2: Build
FROM restore AS build
RUN dotnet build -c Release --no-restore --no-incremental

# Stage 3: Publish
FROM build AS publish
RUN dotnet publish src/RenoveJa.Api/RenoveJa.Api.csproj -c Release -o /app/publish --no-build

# Stage 4: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0.12-bookworm-slim AS runtime
WORKDIR /app

# Install required native dependencies for iText/BouncyCastle
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser

COPY --from=publish /app/publish .

RUN mkdir -p /app/logs && chown -R appuser:appuser /app

USER appuser

# ECS e ambientes AWS usam porta 8080
ENV PORT=8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Health check delegado ao ALB target group (mais confiável que Docker HEALTHCHECK).
# Docker HEALTHCHECK com start-period curto causava ciclo de restart no ECS.
HEALTHCHECK NONE

ENTRYPOINT ["dotnet", "RenoveJa.Api.dll"]
