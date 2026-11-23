# CoreScope device management

The Manage CoreScope tab on the Acadiana Mesh site opens the analyzer’s own admin area. The analyzer requires an existing CoreScope administrator account and checks its session and CSRF token before accepting an archive request.

The patch targets CoreScope v3.17.0 at commit `6dd62711bc79b3f502dd48736899c613b93b4469`. Apply it in a clean checkout of that version. Build both the server and ingestor from that checkout and deploy them together using the existing CoreScope image build. The server reads the analyzer database and queues requests. The ingestor applies them. The device queue is separate from the geographic prune queue.

```sh
git apply --check /path/to/Acadiana-mesh-site/infra/corescope/manage-devices.patch
git apply /path/to/Acadiana-mesh-site/infra/corescope/manage-devices.patch
(cd cmd/server && go test ./...)
(cd cmd/ingestor && go test ./...)
node tests/unit/test-admin-dashboard-ui.js
```

Archive moves a repeater to CoreScope’s inactive-node table or marks an observer inactive. History stays available under existing CoreScope retention settings. A new advertisement or live observer report can return the record to the active list. Acadiana Mesh directory records are managed separately. CoreScope’s Audit tab records who requested each archive.
