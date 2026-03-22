"""Package configuration for solfoundry-cli.

Install with: pip install -e .
This registers the ``sf`` console command.
"""

from setuptools import setup, find_packages

setup(
    name="solfoundry-cli",
    version="0.1.0",
    description="CLI tool for interacting with SolFoundry bounties",
    long_description=(
        "A terminal interface for power users and AI agents to list, claim, "
        "submit, and check the status of SolFoundry bounties. Communicates "
        "with the SolFoundry backend API."
    ),
    author="SolFoundry Contributors",
    license="MIT",
    python_requires=">=3.10",
    packages=find_packages(),
    install_requires=[
        "click>=8.0,<9.0",
        "httpx>=0.27.0,<1.0.0",
        "pyyaml>=6.0,<7.0",
        "pydantic>=2.0,<3.0",
    ],
    entry_points={
        "console_scripts": [
            "sf=app.cli.main:cli",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Environment :: Console",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Build Tools",
    ],
)
