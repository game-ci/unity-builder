ARG IMAGE
FROM $IMAGE

LABEL "com.github.actions.name"="Unity - Builder"
LABEL "com.github.actions.description"="Build Unity projects for different platforms."
LABEL "com.github.actions.icon"="box"
LABEL "com.github.actions.color"="gray-dark"

LABEL "repository"="http://github.com/game-ci/unity-actions"
LABEL "homepage"="http://github.com/game-ci/unity-actions"
LABEL "maintainer"="Webber Takken <webber@takken.io>"

ADD default-build-script /UnityBuilderAction
ADD platforms/ubuntu/steps /steps
RUN chmod -R +x /steps
ADD platforms/ubuntu/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN ls

ENTRYPOINT ["/entrypoint.sh"]
