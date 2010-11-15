#!/bin/bash

export a="twitterbar/chrome/locale/en-US/"
export b="twitterbar/chrome/content/"
echo "Unused entities:"

for dtdfile in `ls $a*.dtd` 
do
	awk '/<!ENTITY/ {print $2}' < $dtdfile | while read line
	do
		search=`grep -R "${line}" "$b"`
		if [ "$search" == "" ]
		then
				echo "${line}";
		fi
	done;
done;

echo ""
echo "Unused properties:"

for propfile in `ls $a*.properties`
do
	awk -F "=" '{if (!($2 == "")) { print $1 }}' < $propfile | while read line
	do
		search=`grep -R "${line}" "$b"`
		if [ "$search" == "" ]
		then
				echo "${line}";
		fi
	done;
done;
