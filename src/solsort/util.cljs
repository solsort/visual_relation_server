(ns solsort.util
  (:require-macros [cljs.core.async.macros :refer [go go-loop alt!]])
  (:require
    [solsort.keyval-db :as kvdb]
    [clojure.string :as string :refer [split]]
    [cljs.core.async :refer [>! <! chan put! take! timeout close! pipe]]))

(defn parse-json-or-nil [str]
  (try
    (js/JSON.parse str)
    (catch :default _ nil)))

(defn http-req
  ([url params] (throw "not implemented"))
  ([url]
   (let
     ;TODO ie8/9-cors-support
     [result (chan)
      xhr (js/XMLHttpRequest.)]
     (.open xhr "GET" url true)
     (set! (.-withCredentials xhr) true)
     (set! (.-onerror xhr) #(close! result))
     (set! (.-onload xhr) #(put! result (.-responseText xhr)))
     (.send xhr)
     result)))
(defn print-channel [c]
  (go (loop [msg (<! c)]
        (if msg (do (print msg) (recur (<! c)))))))

(defn kvdb-store-channel [db c]
  (go-loop 
    [key-val (<! c)]
    (if key-val
      (let [[k v] key-val]
        (<! (kvdb/store db k (clj->js v)))
        (recur (<! c)))
      (<! (kvdb/commit db)))))

(defn by-first [xf]
  (let [prev-key (atom nil)
        values (atom '())]
    (fn 
      ([result] 
       (if (< 0 (count @values)) 
         (do
           (xf result [@prev-key @values])
           (reset! values '())))
       (xf result))
      ([result input]
       (if (= (first input) @prev-key)
         (swap! values conj (rest input))
         (do 
           (if (< 0 (count @values)) (xf result [@prev-key @values]))
           (reset! prev-key (first input))
           (reset! values (list (rest input)))))))))

(defn transducer-status [s]
  (fn [xf]
    (let [prev-time (atom 0)
          cnt (atom 0)]
      (fn 
        ([result]
         (print s 'done)
         (xf result))
        ([result input]
         (swap! cnt inc)
         (if (< 60000 (- (.now js/Date) @prev-time))
           (do
             (reset! prev-time (.now js/Date))
             (print s @cnt)))
         (xf result input))))))

(defn transducer-accumulate [initial]
  (fn [xf]
    (let [acc (atom initial)]
      (fn 
        ([result]
         (if @acc (do
                    (xf result @acc)
                    (reset! acc nil)))
         (xf result))
        ([result input] 
         (swap! acc conj input))))))

(def group-lines-by-first
  (comp
    by-first
    (map (fn [[k v]] [k (map (fn [[s]] s) v)]))))

(defn swap-trim  [[a b]] [(string/trim b) (string/trim a)])

