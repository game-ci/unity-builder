apk update
apk add unzip
apk add git-lfs
apk add jq

GITHUB_TOKEN=$1
GITHUB_REPO=$2
BUILD_ID=$3
REPO_PATH_NAME=$4
EFS_PATH_NAME=$5
CACHE_PATH_NAME=$6
BRANCH_NAME=$7


# Get source repo for project to be built and game-ci repo for utilties
git clone https://$GITHUB_TOKEN@github.com/$GITHUB_REPO.git $BUILD_ID/$REPO_PATH_NAME -q
git clone https://$GITHUB_TOKEN@github.com/game-ci/unity-builder.git $BUILD_ID/builder -q

cd /$EFS_PATH_NAME/$BUILD_ID/$REPO_PATH_NAME/
git checkout $GITHUB_SHA
cd /$EFS_PATH_NAME/

# Look for usable cache
if [ ! -d $CACHE_PATH_NAME ]; then
    mkdir $CACHE_PATH_NAME
fi
    cd $CACHE_PATH_NAME
if [ ! -d "$BRANCH_NAME" ]; then
    mkdir "$BRANCH_NAME"
fi
cd "$BRANCH_NAME"
echo ' '
echo "Cached Libraries for $BRANCH_NAME from previous builds:"
ls
echo ' '
libDir=/${efsDirectoryName}/$BUILD_ID/$REPO_PATH_NAME/${buildParameters.projectPath}/Library

if [ -d "$libDir"  ]; then
    echo "Library folder already present, make sure you setup .gitignore correctly"
    echo "Cleaning out Library folder for this build"
    rm -r "$libDir"
fi

echo "Checking cache"
# Restore cache
latest=$(ls -t | head -1)
if [ ! -z "$latest" ]; then
    echo "Library cache exists from build $latest from ${branchName}"
    echo "Creating empty Library folder for cache"
    mkdir "$libDir"
    unzip -q "$latest" -d "$libDir/."
else
    echo "Cache does not exist"
fi

# Print out important directories
echo ' '
echo 'Repo:'
ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
echo ' '
echo 'Project:'
ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}
echo ' '
echo 'Library:'
ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/
echo ' '