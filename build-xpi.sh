rm -rf .xpi_work_dir/

chmod -R 0777 twitterbar/
rm -f twitterbar.xpi
mkdir .xpi_work_dir
cp -r twitterbar/* .xpi_work_dir/
cd .xpi_work_dir/

rm -rf `find . -name ".svn"`
rm -rf `find . -name ".DS_Store"`
rm -rf `find . -name "Thumbs.db"`

cd chrome/
zip -rq ../twitterbar.jar *
rm -rf *
mv ../twitterbar.jar ./
cd ../
zip -rq ~/Desktop/twitterbar.xpi *
cd ..

rm -rf .xpi_work_dir/
