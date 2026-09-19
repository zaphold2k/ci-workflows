def add(a, b):
    return a + b


def greet(name):
    import os  # noqa: E402 -- deliberate fixture suppression, exercised by the ratchet's suppression count

    return f"Hello, {name} (pid {os.getpid()})!"
