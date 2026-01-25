#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./App.js";

// Clear screen on start for clean TUI
process.stdout.write("\x1B[2J\x1B[0f");

render(<App />);
