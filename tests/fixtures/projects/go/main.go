package main

import (
	"fmt"
	"os"
)

func add(a, b int) int {
	return a + b
}

func greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func main() {
	fmt.Println(greet("world"))
	//nolint:errcheck // deliberate fixture suppression, exercised by the ratchet's suppression count
	fmt.Fprintln(os.Stdout, add(2, 3))
}
