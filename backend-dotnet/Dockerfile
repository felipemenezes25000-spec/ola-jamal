# ============================================================
# RenoveJá Backend - Multi-stage Dockerfile
# ============================================================

# Stage 1: Restore dependencies
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS restore
WORKDIR /src
COPY *.sln .
COPY src/RenoveJa.Domain/*.csproj src/RenoveJa.Domain/
COPY src/RenoveJa.Application/*.csproj src/RenoveJa.Application/
COPY src/RenoveJa.Infrastructure/*.csproj src/RenoveJa.Infrastructure/
COPY src/RenoveJa.Api/*.csproj src/RenoveJa.Api/
COPY tests/RenoveJa.UnitTests/*.csproj tests/RenoveJa.UnitTests/
RUN dotnet restore

# Stage 2: Build
FROM restore AS build
COPY . .
RUN dotnet build -c Release --no-restore

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

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "RenoveJa.Api.dll"]
