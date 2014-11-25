mkdir tmp
echo "extracting/sorting coloans (takes some time...)"
xzcat coloans/* | sort > tmp/coloans.csv
echo "sorting coloans by lid (takes some time...)"
cat tmp/coloans.csv | sort > tmp/coloans-by-lid.csv
echo "extracting info"
xzcat id-cluster-title-creator-type.csv.xz > tmp/info.csv
echo installing dependencies
npm install
echo building database
node generate_database.js
