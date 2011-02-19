rm -rf .xpi_work_dir/

rm -f twitterbar.xpi
mkdir .xpi_work_dir
cp -r twitterbar/* .xpi_work_dir/
cd .xpi_work_dir/

rm -rf `find . -name ".git"`
rm -rf `find . -name ".DS_Store"`
rm -rf `find . -name "Thumbs.db"`

zip -rq ~/Desktop/twitterbar.xpi *
cd ..

rm -rf .xpi_work_dir/