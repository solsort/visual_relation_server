# Visualisering af relationer - related-server

## *under udvikling, fungerer ikke endnu*

Dette repositorie indeholder en server til anbefalinger af danske biblioteksmaterialer.

Krav for kørsel: unix-shell, xz, node, sort, build-environment

Database bliver bygget/installeret med `./createdb.sh`, - dette tager en del tid...

Herefter kan serveren startes med: `node server.js`

Data i repositoriet er baseret på det ADHL-datasæt som DBC frigav på hack4dk-2014 (hackathon for åbne kulturdata). 
Nogle data her er aggregerede og tilføjet lidt støj.

- `coloans/*.csv` har statistik over hvilke materialer samme bruger har lånt, fordelt på måneder.
- `id-cluster-title-creator-type.csv` har metadata for materialer titel/creator/...
- `stats.jsonl` har statistik om de enkelte materialer, køn/alders-fordeling etc., som line delimited json.

Alle data er komprimeret med `xz` a pladshensyn.
