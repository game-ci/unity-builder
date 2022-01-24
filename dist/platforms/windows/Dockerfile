ARG IMAGE
FROM $IMAGE

LABEL "com.github.actions.name"="Unity - Builder"
LABEL "com.github.actions.description"="Build Unity projects for different platforms."
LABEL "com.github.actions.icon"="box"
LABEL "com.github.actions.color"="gray-dark"

LABEL "repository"="http://github.com/game-ci/unity-actions"
LABEL "homepage"="http://github.com/game-ci/unity-actions"
LABEL "maintainer"="Webber Takken <webber@takken.io>"

COPY default-build-script c:/UnityBuilderAction
COPY platforms/windows/steps c:/steps
COPY platforms/windows/entrypoint.ps1 c:/entrypoint.ps1
RUN ls

ENTRYPOINT ["powershell", "c:/entrypoint.ps1"]
