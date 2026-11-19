# PocketBase for the Acadiana Mesh repeater directory (repeaters.acadianamesh.com).
FROM alpine:3.20
ARG PB_VERSION=0.40.6
ARG PB_SHA256=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f
RUN apk add --no-cache ca-certificates tzdata \
 && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
 && echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && mkdir -p /pb && unzip -q /tmp/pb.zip pocketbase -d /pb && rm /tmp/pb.zip
COPY pb_migrations /pb/pb_migrations
EXPOSE 8090
# Settings (including the SMTP login) are encrypted at rest with the key in $PB_ENCRYPTION_KEY.
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--automigrate=false", "--encryptionEnv=PB_ENCRYPTION_KEY"]
