#!/bin/bash
# Deploy Synapse sites to GitHub Pages

# Dashboard (Vite/React)
cd synapse-frontend
git checkout -b gh-pages-dashboard 2>/dev/null || git checkout gh-pages-dashboard
git rm -rf .
cp -r dist/* .
git add .
git commit -m "Deploy dashboard"
git push origin gh-pages-dashboard --force

# Landing (Next.js)  
cd ../synapse-landing
git checkout -b gh-pages-landing 2>/dev/null || git checkout gh-pages-landing
git rm -rf .
cp -r dist/* . 2>/dev/null || cp -r out/* . 2>/dev/null
git add .
git commit -m "Deploy landing"
git push origin gh-pages-landing --force

echo "Deployed to:"
echo "Dashboard: https://AyrtonMansi.github.io/synapse-dashboard"
echo "Landing: https://AyrtonMansi.github.io/synapse-landing"