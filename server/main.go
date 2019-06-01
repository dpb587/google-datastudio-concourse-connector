package main

import (
	"bufio"
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"

	"github.com/pkg/errors"
)

func loadTarget(r *http.Request) (string, string, error) {
	username, _, _ := r.BasicAuth()
	if username == "" {
		username = os.Getenv("FLY_TARGET")
	}

	var targetName, targetURL, host string

	usernamePieces := strings.SplitN(username, "@", 2)
	if len(usernamePieces) > 1 {
		host = usernamePieces[1]
		username = usernamePieces[0]
	} else {
		host = username
		username = ""
	}

	stdoutTargets := &bytes.Buffer{}
	cmd := exec.Command("fly", "targets")
	cmd.Stdout = stdoutTargets
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err != nil {
		return "", "", errors.Wrap(err, "listing targets")
	}

	var found bool

	scanner := bufio.NewScanner(strings.NewReader(stdoutTargets.String()))
	for scanner.Scan() {
		lineSplit := strings.Fields(scanner.Text())
		uri, err := url.Parse(lineSplit[1])
		if err != nil {
			continue
		}

		if uri.Host != host {
			continue
		}

		targetName = lineSplit[0]
		targetURL = lineSplit[1]

		found = true

		break
	}

	if !found {
		return "", "", fmt.Errorf("failed to find target: %s", host)
		// TODO add target
	}

	// TODO login?

	return targetName, targetURL, nil
}
func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "google-datastudio-connector-concourse-builds")
	})

	http.HandleFunc("/builds", func(w http.ResponseWriter, r *http.Request) {
		targetName, _, err := loadTarget(r)
		if err != nil {
			panic(err)
		}

		args := []string{
			fmt.Sprintf("--target=%s", targetName),
			"builds",
			"--count=10000", // TODO limited for dev safety
			"--json",
		}

		q := r.URL.Query()

		if v := q.Get("since"); v != "" {
			args = append(args, fmt.Sprintf("--since=%s 00:00:00", v))
		}

		if v := q.Get("until"); v != "" {
			args = append(args, fmt.Sprintf("--until=%s 23:59:59", v))
		}

		if v := q.Get("teamName"); v != "" {
			args = append(args, fmt.Sprintf("--team=%s", v))
		}

		if v := q.Get("pipelineName"); v != "" {
			args = append(args, fmt.Sprintf("--pipeline=%s", v))
		}

		if v := q.Get("jobName"); v != "" {
			args = append(args, fmt.Sprintf("--job=%s/%s", q.Get("pipelineName"), v))
		}

		w.Header().Set("content-type", "application/json")

		fmt.Fprintf(os.Stderr, "fly %s\n", strings.Join(args, " "))

		cmd := exec.Command("fly", args...)
		cmd.Stdout = w
		cmd.Stderr = os.Stderr

		err = cmd.Run()
		if err != nil {
			panic(err)
		}
	})

	http.ListenAndServe(":3001", nil)
}
