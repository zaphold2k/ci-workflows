package main

import "testing"

func TestAdd(t *testing.T) {
	if got := add(2, 3); got != 5 {
		t.Fatalf("add(2, 3) = %d, want 5", got)
	}
}

func TestGreet(t *testing.T) {
	if got := greet("world"); got != "Hello, world!" {
		t.Fatalf("greet(%q) = %q, want %q", "world", got, "Hello, world!")
	}
}
