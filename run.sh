#!/bin/bash

# Check if PostgreSQL container is running
if ! docker ps | grep -q vet-dur-db; then
    echo "Starting PostgreSQL container..."
    docker start vet-dur-db
    sleep 5
fi

echo "Setting up database..."
cd ddi_engine && /workspaces/FullStackDemoPractice/.venv/bin/python db/setup.py && cd ..

echo "Running DDI engine tests..."
/workspaces/FullStackDemoPractice/.venv/bin/python ddi_engine/engine.py