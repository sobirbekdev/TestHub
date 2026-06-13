#!/bin/bash
# TestHub VPS Deploy skripti
# Ishlatish: ./deploy.sh

set -e

echo "🚀 TestHub deploy boshlanmoqda..."

# 1. Migrate
echo "📦 Database migrate..."
cd backend
export $(cat ../.env.production | grep -v '#' | xargs)
export DATABASE_URL="postgresql://testhub:${DB_PASSWORD}@localhost:5432/testhub"
npx prisma migrate deploy
cd ..

# 2. Docker build va ishga tushirish
echo "🐳 Docker build..."
docker-compose --env-file .env.production up -d --build

# 3. Eskilarni tozalash
docker image prune -f

echo "✅ Deploy yakunlandi!"
echo "🌐 https://testhub.uz"
