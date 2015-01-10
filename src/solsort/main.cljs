(ns solsort.main
  (:require
    [solsort.bib-related]
    ))

(enable-console-print!)
(aset js/window "onload" solsort.bib-related/start)
