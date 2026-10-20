# Conversion engine contract

The website never converts anything itself. It stores each upload as a **job** in Supabase and waits for
something to move the job forward. Today that is the owner panel (`/admin`). The engine replaces the owner
by doing the same steps with the Supabase **secret key**. Nothing in the website has to change when the
engine arrives.

Customer-facing text never names the model or the tooling behind the engine. Keep error messages and
`estimate_note` in plain language about the drawing.

## Lifecycle

```
estimating ──quote──▶ quoted ──customer confirms──▶ queued ──claim──▶ processing ──complete──▶ done
     │                  │                                        │
     └──── fail ────────┴──── customer cancels ──▶ cancelled      └──── fail (coins kept) ──────▶ failed
```

| Status       | Who moves it on        | How                                                    |
| ------------ | ---------------------- | ------------------------------------------------------ |
| `estimating` | engine                 | `engine_claim_job('estimating')`, then `engine_quote_job` or `engine_fail_job` |
| `quoted`     | customer               | confirms (coins are taken) or cancels                  |
| `queued`     | engine                 | `engine_claim_job('queued')` → becomes `processing`    |
| `processing` | engine                 | `engine_progress` while working, then `engine_complete_job` or `engine_fail_job` |

All `engine_*` functions are callable only with the secret (service-role) key.

## Finding work

Either poll every few seconds:

```sql
select * from engine_claim_job('estimating');  -- returns null when there is nothing
select * from engine_claim_job('queued');      -- also flips it to processing
```

`engine_claim_job` uses `for update skip locked`, so several workers can run side by side safely.

Or set `ENGINE_WEBHOOK_URL` (and `ENGINE_WEBHOOK_SECRET`) on the website. It then POSTs
`{"event": "job.created" | "job.confirmed", "job_id": "…"}` with `Authorization: Bearer <secret>`. Treat the
ping as a hint and still claim through `engine_claim_job`.

## Inputs

| Column         | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `source_path`  | file in the private `drawings` bucket: `<user_id>/<uuid>/<file name>`  |
| `source_kind`  | `pdf`, `image`, `dwg` or `dxf`                                          |
| `units`        | `auto` (read from the sheet), `mm` or `inch`                            |
| `notes`        | the customer's free-text note (may be null)                             |
| `name`         | the customer's name for the part                                        |

Download the drawing with the secret key: `storage.from('drawings').download(source_path)`.

## Pricing a drawing

```sql
select engine_quote_job(:job_id, 'simple' | 'medium' | 'complex', :note);
```

The coin cost comes from the `tiers` table. `note` is shown to the customer under the price, e.g.
"Three views and a section, 11 dimensions, one H7 bore." The tier descriptions on the site are:

- **simple**: one prismatic part: plates, spacers, brackets. Holes, slots, pockets, fillets and chamfers.
- **medium**: several views with sections: housings, blocks, flanged parts, turned parts with features.
- **complex**: castings and machined housings: shells, ribs, bosses, intersecting bores, many tapped holes.

## Reporting progress

```sql
select engine_progress(:job_id, :percent, :stage);
```

The model page lists these stages and ticks them off. Use the exact text so the right one lights up:

1. `Reading the drawing`
2. `Finding views and dimensions`
3. `Building the solid`
4. `Checking it against your sheet`
5. `Exporting the STEP`

`percent` is 0–99 (100 is set by completion).

## Delivering the model

Upload to the private `models` bucket under the job's folder, then complete:

| Path                                  | Required | What                                                                          |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `<user_id>/<job_id>/model.step`       | yes      | the STEP file the customer downloads (AP214 or AP242, millimetres)            |
| `<user_id>/<job_id>/model.glb`        | no       | browser preview. If missing, the browser reads the STEP itself (slower).      |
| `<user_id>/<job_id>/thumb.webp`       | no       | ~640×480 render on a white or transparent ground, shown in the history grid  |

```sql
select engine_complete_job(:job_id, :step_path, :glb_path_or_null, :thumb_path_or_null, :result_json);
```

### Preview GLB

One mesh per B-rep face, each node named so the viewer can tell the customer what they are pointing at:

```
face:<index>;k=<plane|cylinder|cone|torus|surface>;a=<area mm²>;n=<nx,ny,nz>      (planes)
face:<index>;k=cylinder;a=<area>;d=<diameter>;span=<degrees>;cv=<1 convex|0 concave>
```

plus one `LINES` node named `edges` with the B-rep edges. Coordinates in millimetres, Z up.
`tools/examples/build_examples.py` (`export_preview`, `face_label`) is a working reference implementation
in build123d / OpenCascade. Copy it.

### `result` JSON

Every field is optional; the model page shows what is there.

```json
{
  "bbox": [150, 44, 98],
  "volume_mm3": 266691.6,
  "faces": 34,
  "step_bytes": 148834,
  "units": "mm",
  "checks": [
    { "label": "Bore", "drawing": "Ø47 H7", "model": "47.000", "ok": true }
  ],
  "assumptions": ["Thread on the side port taken as M10 × 1.5; the sheet shows it but doesn't call it out."]
}
```

`checks` is the dimension check the site promises ("each dimension on the drawing is measured on the
finished solid"). Fill it for every dimension you read off the sheet.

## When a drawing can't be converted

```sql
select engine_fail_job(:job_id, :message);
```

Works from any open status. Coins already taken are not refunded; nothing is charged for a drawing that fails before
it is confirmed. The message is shown to the customer as is: say what is missing and what would fix it
("The side view is missing, so the depth of the pocket can't be read. Add the side view and upload again.").
