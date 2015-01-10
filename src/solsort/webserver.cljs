(ns solsort.webserver
  (:require-macros [cljs.core.async.macros :refer [go alt!]])
  (:require
    [clojure.string :refer [split]]
    [solsort.system :as system]
    [cljs.core.async :refer [>! <! chan put! take! timeout close!]]))

(def initialised (atom false))
(def services (atom {:default #(go #js{:error "not found"})}))

(defn path-split [string]
  (let [[full-path param] (.split string "?")
        path-parts (filter #(< 0 (.-length %)) (seq (.split full-path "/")))
        params (into {} (map #(split % #"=" 2) (split param "&")))
        ]
    [(butlast path-parts) (last path-parts) params]))

(defn http-serve [req res]
  (go
    (let [[path id params] (path-split (.-url req))
          f (or (@services (first path)) 
                (@services :default))
          split-pos (.lastIndexOf id ".")
          filename (if (< 0 split-pos) (.slice id 0 split-pos) id)
          extension (if (< 0 split-pos) (.slice id (inc split-pos)) "")
          info {:path path :filename filename :extension extension :params params}
          ]
      (.setHeader res "Content-Type" "application/javascript")
      (.end res (str (params "callback") "(" (js/JSON.stringify (clj->js (<! (f info)))) ")"))
      )))

(defn start-server []
  (if (not system/nodejs)
    (throw "error: not on node"))
  (go
    (let [c (chan)
          http (js/require "http")
          server (.createServer http http-serve)
          port (or (aget js/process.env "PORT") 1337)
          host (or (aget js/process.env "HOST") "localhost") ]
      (.listen server port host)
      (print (str "starting server on " host ":" port)))))

(defn add [path f]
  (if (not @initialised)
    (do
      (reset! initialised true)
      (start-server)))
  (go
    (swap! services assoc path f)
    true))
