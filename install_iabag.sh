#!/bin/bash
aws s3 rm s3://iabag.fr --recursive
aws s3 cp ./dist s3://iabag.fr --recursive
