import sys
from pathlib import Path

import simfile


output = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/stepper-export-smoke")
expected = {
    "title": "Escaped: title; \\ test",
    "artist": "Artist: A; B",
    "offset": "-0.125000",
    "bpms": "0.000000=120.000000,16.000000=180.000000",
    "stops": "8.000000=0.500000",
}

for extension in ("sm", "ssc"):
    parsed = simfile.open(str(output / f"fixture.{extension}"), strict=True)
    for field, value in expected.items():
        assert getattr(parsed, field) == value, (extension, field, getattr(parsed, field))
    assert len(parsed.charts) == 1
    chart = parsed.charts[0]
    assert chart.description == "Escaped: chart; \\ metadata"
    if extension == "ssc":
        assert chart.offset == "0.250000"
        assert chart.bpms == "0.000000=150.000000,8.000000=200.000000"

print("simfile 2.1.1 strict parse passed for SM and SSC")
