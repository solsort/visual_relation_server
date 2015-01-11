# Visualisering af relationer - related-server

Dette repositorie indeholder en server til anbefalinger af danske biblioteksmaterialer.

Krav for kørsel: unix-shell, xz, node, sort

Kørsel:

    npm install
    npm start

Ved første kørsel udregnes relationer etc., - dette tager en uges tid afhængigt af computer, og kræver en del plads, 100GB burde være tilstrækkeligt.

----

Krav ifbm. udvikling: java, lein

Oversættelse af kode

    lein cljsbuild auto

----

Data i repositoriet er baseret på det ADHL-datasæt som DBC frigav på hack4dk-2014 (hackathon for åbne kulturdata). 
Nogle data her er aggregerede og tilføjet lidt støj.

- `coloans/*.csv` har statistik over hvilke materialer samme bruger har lånt, fordelt på måneder.
- `id-cluster-title-creator-type.csv` har metadata for materialer titel/creator/...
- `stats.jsonl` har statistik om de enkelte materialer, køn/alders-fordeling etc., som line delimited json.

Alle data er komprimeret med `xz` a pladshensyn.
