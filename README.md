# Istasyon Takip Backend (Phase 1)

Bu proje, mobil uygulamanin kullandigi merkezi bir backend olarak EV test istasyonlarini yonetmek icin hazirlanmistir.

## Kullanim Amaci
- Istasyonlari merkezi olarak listelemek, olusturmak, guncellemek, arsivlemek ve silmek
- Istasyon bazli dinamik custom field yapisini yonetmek
- Istasyon test gecmisi tutmak
- Istasyon ariza/kayitlarini takip etmek
- Basit ama genisletilebilir bir auth yapisi saglamak

## Teknoloji Yigini
- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM (`drizzle-orm` + `pg`)

## Proje Mimarisi
Kod tabani moduler olacak sekilde ayrilmistir:
- `routes`: Sadece HTTP katmani, request/response schema ve preHandler
- `services`: Is kurallari ve uygulama mantigi
- `repositories`: Veritabani erisimi (Drizzle sorgulari)
- `plugins`: Auth, hata yakalama gibi ortak Fastify davranislari
- `utils`: Ortak yardimci fonksiyonlar

## Klasor Yapisi
```text
src/
  app.ts
  server.ts
  config/
    env.ts
  db/
    client.ts
    schema.ts
    seed.ts
  modules/
    auth/
    stations/
    custom-fields/
    test-history/
    issues/
    users/
  plugins/
    auth.ts
    error-handler.ts
  utils/
  types/

drizzle/
  *.sql
  meta/
```

## Kurulum
1. Bagimliliklari yukle:
```bash
npm install
```

2. Ortam degiskenlerini olustur:
```bash
cp .env.example .env
```

3. Veritabanini migrate et:
```bash
npm run db:migrate
```

4. Seed verisini bas:
```bash
npm run seed
```

5. Gelistirme modunda calistir:
```bash
npm run dev
```

## NPM Scriptleri
- `npm run dev`: Gelistirme modunda calistirir (`tsx watch`)
- `npm run build`: TypeScript derleme
- `npm run start`: Derlenmis projeyi calistirir
- `npm run db:generate`: Drizzle migration SQL uretir
- `npm run db:migrate`: Migrationlari uygular
- `npm run db:push`: Drizzle schema'yi direkt DB'ye push eder
- `npm run db:studio`: Drizzle Studio acar
- `npm run seed`: Seed verisi yukler
- `npm run db:setup`: Migrate + seed

## Ortam Degiskenleri
Ornek dosya: `.env.example`

Gerekli temel degiskenler:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `HOST`
- `PORT`

Not: `DATABASE_URL` icinde sifrede `/`, `@`, `:`, `#`, `?`, `%` gibi karakterler varsa URL-encode edilmelidir.

## Faz 1 Endpointleri
### Auth
- `POST /auth/login`
- `GET /auth/me`

### Stations
- `GET /stations`
- `GET /stations/:id`
- `POST /stations`
- `PUT /stations/:id`
- `DELETE /stations/:id`
- `POST /stations/:id/archive`

### Custom Fields
- `GET /custom-fields`
- `POST /custom-fields`
- `PUT /custom-fields/:id`
- `PATCH /custom-fields/:id/active`

### Test History
- `GET /stations/:id/test-history`
- `POST /stations/:id/test-history`

### Issues
- `GET /stations/:id/issues`
- `POST /stations/:id/issues`
- `PATCH /issues/:id/status`

## Filtreleme (GET /stations)
Asagidaki filtreler desteklenir:
- `search`
- `status`
- `brand`
- `currentType`
- `sortBy`
- Dinamik custom field filtreleri (`cf.<key>=<value>`)

Ornek:
```http
GET /stations?status=active&cf.firmware_version=v3
```

## Seed Hesaplari
- `admin@evlab.local` / `Admin123!`
- `operator@evlab.local` / `Operator123!`

## Faz 2 Icin Oneriler
- Rol bazli yetkilendirme (RBAC)
- Sayfalama + toplam sayi metadata
- Test kapsami (unit + integration)
- API dokumantasyonu (OpenAPI/Swagger)
