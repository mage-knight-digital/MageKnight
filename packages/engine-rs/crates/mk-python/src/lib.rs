//! PyO3 bindings for Python interop.

use pyo3::prelude::*;

#[pymodule]
fn mk_python(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", "0.1.0")?;
    Ok(())
}
