#!/bin/bash

export a="twitterbar/chrome/skin/"
export b="twitterbar/"

echo "Unused files:"

for skinfile in `ls $a` 
do
	search=`grep -R "${skinfile}" "$b" | grep -v ".svn"`
	if [ "$search" == "" ]
	then
		echo "${skinfile}";
	fi
done;
