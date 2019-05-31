package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "google-datastudio-connector-concourse-builds")
	})

	http.HandleFunc("/builds", func(w http.ResponseWriter, r *http.Request) {
		args := []string{
			fmt.Sprintf("--target=%s", os.Args[1]),
			"builds",
			"--count=100000",
			"--json",
		}

		q := r.URL.Query()

		if v := q.Get("since"); v != "" {
			args = append(args, fmt.Sprintf("--since=%s 00:00:00", v))
		}

		if v := q.Get("until"); v != "" {
			args = append(args, fmt.Sprintf("--until=%s 00:00:00", v))
		}

		if v := q.Get("teamName"); v != "" {
			args = append(args, fmt.Sprintf("--team-name=%s", v))
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

		err := cmd.Run()
		if err != nil {
			panic(err)
		}
	})

	http.ListenAndServe(":3001", nil)
}
