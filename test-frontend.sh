#!/bin/bash
echo "=== Testing Frontend Deployment ==="
echo ""
echo "1. Checking if frontend container is running..."
docker ps | grep catalyst-frontend && echo "✅ Frontend container is running" || echo "❌ Frontend container not found"
echo ""
echo "2. Checking frontend port..."
curl -s http://localhost:3005 > /dev/null && echo "✅ Frontend is accessible on port 3005" || echo "❌ Cannot reach frontend"
echo ""
echo "3. Container logs (last 10 lines):"
docker logs --tail 10 catalyst-frontend
echo ""
echo "=== Frontend is ready at http://$(curl -s ifconfig.me):3005 ==="
