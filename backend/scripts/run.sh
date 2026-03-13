#!/bin/bash

# Check if PostgreSQL container is running
if ! docker ps | grep -q vet-dur-db; then
    echo "Starting PostgreSQL container..."
    docker start vet-dur-db
    sleep 5
fi

echo "Setting up database..."
cd backend && /workspaces/FullStackDemoPractice/backend/.venv/bin/python db/setup.py && cd ..

echo "Running DDI engine tests..."
cd /workspaces/FullStackDemoPractice && /workspaces/FullStackDemoPractice/backend/.venv/bin/python backend/engine.py