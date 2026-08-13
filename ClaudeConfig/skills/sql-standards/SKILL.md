---
name: sql-standards
description: >
  Estándares SQL para el proyecto: tipos de datos, naming, constraints y convenciones de escritura.
  Trigger: Cuando el agente crea tablas SQL, escribe queries, INSERTs, UPDATEs, stored procedures,
  views, scripts de migración o cualquier artifact relacionado con SQL o base de datos.
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "1.0"
paths: "**/*.sql"
---

## When to Use

- Crear o modificar tablas (`CREATE TABLE`, `ALTER TABLE`)
- Escribir queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- Generar seed data o scripts de migración
- Crear views, stored procedures o funciones SQL
- Revisar o corregir código SQL existente

## Critical Patterns

### Tipos de datos de texto — REGLA ABSOLUTA

| ❌ NUNCA | ✅ SIEMPRE |
|----------|-----------|
| `NVARCHAR(n)` | `VARCHAR(n)` |
| `NCHAR(n)` | `CHAR(n)` |
| `NTEXT` | `VARCHAR(MAX)` |
| `N'texto literal'` | `'texto literal'` |

**Razón**: La BD usa collation Latin1 / sin Unicode. NVARCHAR duplica el espacio en disco y degrada performance sin beneficio. VARCHAR es el estándar del ecosistema.

### Tipos de datos numéricos

- `DECIMAL(p, s)` para montos y porcentajes — nunca `FLOAT` ni `REAL`
- `INT` para IDs y contadores — `BIGINT` solo si el volumen lo justifica
- `BIT` para booleanos — nunca `TINYINT` como sustituto

### Naming de objetos

- Tablas: PascalCase, plural → `BonosNiveles`, `BonosBeneficios`
- Columnas: PascalCase → `NivelId`, `FechaCreacion`, `Activo`
- PKs: `[NombreTablaEnSingular]Id` → `NivelId`, `BeneficioId`
- FKs: mismo nombre que la PK referenciada → FK de `NivelId` se llama `NivelId`
- Constraints: `PK_Tabla`, `FK_TablaHija_TablapadreReferencia`, `UQ_Tabla_Columnas`, `DF_Tabla_Columna`
- Índices: `IX_Tabla_Columna`

### Constraints y defaults

- Siempre definir PK explícita con nombre de constraint
- Columnas `Activo BIT NOT NULL` siempre con `DEFAULT 1`
- Columnas de fecha de auditoría: `DATETIME NOT NULL DEFAULT GETDATE()`
- FKs con nombre de constraint explícito — nunca FK implícita

### Escritura de queries

- Keywords SQL en UPPERCASE: `SELECT`, `FROM`, `WHERE`, `JOIN`, `ON`, `GROUP BY`
- Siempre usar alias explícito en JOINs: `BonosNiveles n`, `BonosBeneficios b`
- Nunca `SELECT *` — listar columnas explícitamente
- Filtros de baja selectividad primero en `WHERE` (índices)

## Code Examples

```sql
-- ✅ Correcto
CREATE TABLE [dbo].[BonosNiveles]
(
    [NivelId]   INT          IDENTITY(1,1) NOT NULL,
    [Nombre]    VARCHAR(50)  NOT NULL,
    [Activo]    BIT          NOT NULL CONSTRAINT [DF_BonosNiveles_Activo] DEFAULT 1,

    CONSTRAINT [PK_BonosNiveles] PRIMARY KEY CLUSTERED ([NivelId])
);

-- ✅ INSERT correcto (sin prefijo N en literales)
INSERT INTO [dbo].[BonosNiveles] ([Nombre], [Activo])
VALUES ('Bronce', 1);

-- ❌ Incorrecto — NVARCHAR prohibido
CREATE TABLE [dbo].[Ejemplo]
(
    [Nombre] NVARCHAR(50) NOT NULL  -- ❌
);

INSERT INTO [dbo].[Ejemplo] ([Nombre]) VALUES (N'texto');  -- ❌
```

## Checklist Before Writing SQL

- [ ] ¿Usé `VARCHAR` en lugar de `NVARCHAR`? ✅
- [ ] ¿Usé `CHAR` en lugar de `NCHAR`? ✅
- [ ] ¿Los literales de texto NO tienen prefijo `N`? ✅
- [ ] ¿Usé `DECIMAL` para montos y porcentajes? ✅
- [ ] ¿Las constraints tienen nombre explícito? ✅
- [ ] ¿La PK sigue el patrón `TablaIdEnSingular`? ✅
