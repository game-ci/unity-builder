echo ' '
echo "LFS cache for $branch"
du -sch "$lfsCacheFolder"
echo ' '
echo "Library cache for $branch"
du -sch "$libraryCacheFolder"
echo ' '
echo "Branch: $branch"
du -sch "$cacheFolderWithBranch"
echo ' '
echo 'Full cache'
du -sch "$cacheFolderFull"
echo ' '
