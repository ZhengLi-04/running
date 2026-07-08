import argparse
import json
import sys

from config import JSON_FILE, SQL_FILE
from generator import Generator
from stravalib.exc import Fault


def explain_strava_fault(error: Fault) -> str:
    message = str(error)
    if "Application" in message and "Inactive" in message:
        return (
            "Strava rejected the request because the API application is inactive. "
            "Reactivate the app in the Strava API Settings Dashboard and make sure "
            "the app owner account meets Strava's current developer requirements."
        )
    if "RefreshToken" in message and "invalid" in message.lower():
        return (
            "Strava rejected the refresh token. Update STRAVA_REFRESH_TOKEN in "
            "GitHub Actions secrets with a freshly authorized token."
        )
    return f"Strava sync failed: {message}"


# for only run type, we use the same logic as garmin_sync
def run_strava_sync(
    client_id,
    client_secret,
    refresh_token,
    sync_types: list = [],
    only_run=False,
):
    generator = Generator(SQL_FILE)
    generator.set_strava_config(client_id, client_secret, refresh_token)
    # judge sync types is only running or not
    if not only_run and len(sync_types) == 1 and sync_types[0] == "running":
        only_run = True
    # if you want to refresh data change False to True
    generator.only_run = only_run
    generator.sync(False)

    activities_list = generator.load()
    with open(JSON_FILE, "w") as f:
        json.dump(activities_list, f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("client_id", help="strava client id")
    parser.add_argument("client_secret", help="strava client secret")
    parser.add_argument("refresh_token", help="strava refresh token")
    parser.add_argument(
        "--only-run",
        dest="only_run",
        action="store_true",
        help="if is only for running",
    )
    options = parser.parse_args()
    try:
        run_strava_sync(
            options.client_id,
            options.client_secret,
            options.refresh_token,
            only_run=options.only_run,
        )
    except Fault as error:
        print(explain_strava_fault(error), file=sys.stderr)
        raise SystemExit(1) from error
