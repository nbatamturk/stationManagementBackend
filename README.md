# İstasyon Takip Backend (Phase 1)

Bu proje, mobil uygulamanın kullandığı merkezi bir backend olarak EV test istasyonlarını yönetmek için hazırlanmıştır.

## Kullanım Amacı
- İstasyonları merkezi olarak listelemek, oluşturmak, güncellemek, arşivlemek ve silmek
- İstasyon bazlı dinamik custom field yapısını yönetmek
- İstasyon test geçmişi tutmak
- İstasyon arıza/kayıtlarını takip etmek
- Basit ama genişletilebilir bir auth yapısı sağlamak

## Teknoloji Yığını
- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM (`drizzle-orm` + `pg`)

## Proje Mimarisi
Kod tabanı modüler olacak şekilde ayrılmıştır:
- `routes`: Sadece HTTP katmanı, request/response schema ve preHandler
- `services`: İş kuralları ve uygulama mantığı
- `repositories`: Veritabanı erişimi (Drizzle sorguları)
- `plugins`: Auth, hata yakalama gibi ortak Fastify davranışları
- `utils`: Ortak yardımcı fonksiyonlar

## Klasör Yapısı
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
1. Bağımlılıkları yükle:
```bash
npm install
```

2. Ortam değişkenlerini oluştur:
```bash
cp .env.example .env
```

3. Veritabanını migrate et:
```bash
npm run db:migrate
```

4. Seed verisini bas:
```bash
npm run seed
```

5. Geliştirme modunda çalıştır:
```bash
npm run dev
```

## NPM Scriptleri
- `npm run dev`: Geliştirme modunda çalıştırır (`tsx watch`)
- `npm run build`: TypeScript derleme
- `npm run start`: Derlenmiş projeyi çalıştırır
- `npm run db:generate`: Drizzle migration SQL üretir
- `npm run db:migrate`: Migrationları uygular
- `npm run db:push`: Drizzle schema'yı direkt DB'ye push eder
- `npm run db:studio`: Drizzle Studio açar
- `npm run seed`: Seed verisi yükler
- `npm run db:setup`: Migrate + seed

## Ortam Değişkenleri
Örnek dosya: `.env.example`

Gerekli temel değişkenler:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `HOST`
- `PORT`

Not: `DATABASE_URL` içinde şifrede `/`, `@`, `:`, `#`, `?`, `%` gibi karakterler varsa URL-encode edilmelidir.

## Faz 1 Endpoint'leri
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
Aşağıdaki filtreler desteklenir:
- `search`
- `status`
- `brand`
- `currentType`
- `sortBy`
- Dinamik custom field filtreleri (`cf.<key>=<value>`)

Örnek:
```http
GET /stations?status=active&cf.firmware_version=v3
```

## Seed Hesapları
- `admin@evlab.local` / `Admin123!`
- `operator@evlab.local` / `Operator123!`

## Faz 2 İçin Öneriler
- Rol bazlı yetkilendirme (RBAC)
- Sayfalama + toplam sayı metadata
- Test kapsamı (unit + integration)
- API dokümantasyonu (OpenAPI/Swagger)
