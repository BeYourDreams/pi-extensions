# MiniMax Speech adapter

Adapter command:

```json
{"command": ["python3", "/absolute/path/provider_adapters.py", "minimax-speech"], "timeout_seconds": 600}
```

Required environment: `MINIMAX_API_KEY`. `MINIMAX_BASE_URL` optionally overrides the default
`https://api.minimax.io/v1` and must remain HTTPS.

The job uses the suite's `tts` modality and must have exactly one output. The production prompt is the
line to be spoken, verbatim — not a description of it. Supported public parameters are `model`,
`voice_id`, `emotion`, `speed`, `vol`, `pitch`, `sample_rate`, `bitrate`, and `format`. The requested
format must match the target extension and be `mp3` or `wav`.

`model` and `voice_id` are both required and neither has a default. The model is an account-enabled
endpoint, exactly as for the video providers. The voice is a creative decision recorded in
`视觉设定.md` under the character's 声音方向, and it reaches the adapter through the confirmed job.

## Voice selection

Read the provider's voice listing and confirm availability for the chosen model and account.
The adapter validates the ID format, not catalogue membership. Have `$short-drama-assets` record
the selected ID in the character's 声音方向, then pass it through the confirmed job.

This workflow selects preset voices. The adapter does not enrol or clone a voice;
any supplied recording retains its documented authorization and usage scope. This adapter does
not send that recording as a voice reference. Keep performance instructions outside the spoken
prompt and express them through the supported parameters.

## Request shape

The request is non-streaming with `output_format: hex`, `POST /t2a_v2`, and carries
`voice_setting` (`voice_id`, and any of `emotion`, `speed`, `vol`, `pitch`) alongside `audio_setting`
(`sample_rate`, `bitrate`, `format`). The adapter validates `base_resp.status_code`, decodes
`data.audio` as hexadecimal bytes, and writes it to a private temporary file.

`emotion` accepts the provider's seven values: `happy`, `sad`, `angry`, `fearful`, `disgusted`,
`surprised`, `neutral`. Anything outside that set is refused before submission; it may be an
unsupported direction rather than a typo and needs an explicit mapping to an available value.

## Speech rate

`speed` is accepted in `0.5`–`2.0`. **Its default is not a natural-speech guarantee**: the value that
yields normal pacing differs by voice and model, and `1.0` is only whatever that endpoint does with
no explicit value. The target it is measured against is the project's own baseline — Chinese at about
**2 pronounceable characters per second**, or `format.pacing.spoken_characters_per_second` when the
project declared one (see `$short-drama-pro` 语速基线, PAC-01).

Calibrate before a batch: synthesise one representative line for the chosen `voice_id`, measure its
actual characters-per-second from the returned audio, and pick the `speed` that lands on the
project's baseline. Reuse that value for every line of the same character, and re-measure after a
voice or model change. Pauses are part of the performance the stage documents: confirm from the
sample that in-line breaths and the gap between sentences survive, rather than assuming a parameter
default preserves them.

Protocol reference: [MiniMax Text to Speech](https://platform.minimax.io/docs/api-reference/speech-t2a-http).
