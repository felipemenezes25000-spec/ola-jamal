# ============================================================
# RenoveJá Backend - Multi-stage Dockerfile
# ============================================================

# Stage 1: Restore dependencies
# IMPORTANTE: o contexto de build no Railway/Render é a raiz do repositório.
# Um único COPY evita race condition do BuildKit (erro "unexpected commit digest").
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS restore
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
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install required native dependencies for iText/BouncyCastle
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser
USER appuser

COPY --from=publish /app/publish .

# Permissão para appuser escrever logs (Serilog WriteTo.File)
RUN mkdir -p /app/logs && chown -R appuser:appuser /app

# Render usa PORT=10000 por padrão; ASP.NET Core precisa de ASPNETCORE_URLS
ENV PORT=10000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000

# Usa PORT da env em runtime (Render injeta PORT=10000)
ENTRYPOINT ["sh", "-c", "export ASPNETCORE_URLS=http://+:${PORT:-10000} && exec dotnet RenoveJa.Api.dll"]
